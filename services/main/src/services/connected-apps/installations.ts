import { createHash } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { users } from "../database/schema/auth";
import { connectedInstallation, connectedInstallationAttribution, connectedInstallationBinding, connectedInstallationCapability,
	connectedInstallationEvent, connectedInstallationRevision } from "../database/schema/connected-installation";
import { AppCapabilitySchema, MaximumAppCapabilities, appCapabilityDigest, appCapabilityKey, decodeAppCapabilities } from "./capabilities";

const id = z.uuid().toLowerCase(), version = z.number().int().nonnegative().safe();
const reference = z.strictObject({ id, revision: version.min(1) });
const references = (maximum: number) => z.array(reference).max(maximum).refine(values => new Set(values.map(value => value.id)).size === values.length);
/** Explicit approved capabilities and resource/attribution references; references alone never grant access. @internal */
export const InstallationApprovalSchema = z.strictObject({
	appRevision: version.min(1), validFrom: z.date(), validUntil: z.date().nullable(),
	capabilities: z.array(AppCapabilitySchema).max(MaximumAppCapabilities).refine(values => new Set(values.map(appCapabilityKey)).size === values.length),
	bindings: references(64), attribution: z.strictObject({ entityId: id, representations: references(8).min(1) }).nullable(),
}).refine(value => value.validUntil === null || value.validUntil > value.validFrom);
const base = { installationId: id, ownerScopeId: id, operationId: id, expectedVersion: version, operatorAuthUserId: id, authoritySubjectId: id };
const schema = z.discriminatedUnion("operation", [
	z.strictObject({ ...base, operation: z.literal("prepare"), expectedVersion: z.literal(0), appId: id, workloadPrincipalId: id }),
	z.strictObject({ ...base, operation: z.literal("approve"), approval: InstallationApprovalSchema }),
	z.strictObject({ ...base, operation: z.enum(["suspend", "resume", "revoke"]) }),
]);
/** Scoped installation intent, with exact private audit context captured by its admission owner. @internal */
export type InstallationCommand = z.infer<typeof schema>;
/** Stable original lifecycle result; it is not proof that current credentials or resource grants work. @internal */
export interface InstallationReceipt {
	installationId: string; operationId: string; version: number; credentialEpoch: number;
	approvedRevision: number | null; state: "pending" | "active" | "suspended" | "revoked";
}
/** Stale state, immutable target or a different replay intent. @internal */
export class InstallationConflict extends Error {
	constructor() { super("Installation command conflicts with current state or its receipt"); }
}
/** Current scope/approval policy rejected an installation operation. @internal */
export class InstallationDenied extends Error {
	constructor() { super("Current installation authority is required"); }
}
/** Incomplete current policy or snapshots cannot become installation authority. @internal */
export class InstallationUnavailable extends Error {
	constructor() { super("Installation state or authority is unavailable"); }
}
/** Canonical digest for bounded immutable source references. @internal */
export function installationReferenceDigest(values: readonly { id: string; revision: number }[]) {
	return createHash("sha256").update(values.map(value => `${value.id}:${value.revision}`).sort().join("\n")).digest("hex");
}
function admit(value: boolean | null | undefined) {
	if (value === false) throw new InstallationDenied();
	if (value !== true) throw new InstallationUnavailable();
}
function receipt(event: typeof connectedInstallationEvent.$inferSelect): InstallationReceipt {
	return { installationId: event.installationId, operationId: event.operationId, version: event.version,
		credentialEpoch: event.credentialEpochAfter, state: event.stateAfter,
		approvedRevision: event.operation === "approve" ? event.version : event.retainedApprovedRevision };
}

/**
 * Prepare, approve or change an installation under scope-owned current admission.
 * @internal
 * @remarks The caller admits all resource assignments and attribution separately,
 * promotes their fences, and coordinates workload/client activation in the same
 * transaction. An installation cannot become active before its workload. Preparation
 * does not issue a credential or approve resources. Issuer history is not a live
 * dependency; suspension/reapproval/revocation invalidate old credential epochs.
 */
export async function applyInstallationCommand(tx: DatabaseTransaction, input: InstallationCommand, admission: SQL<boolean | null>): Promise<InstallationReceipt> {
	const command = schema.parse(input);
	if (command.operation === "approve") {
		command.approval.capabilities.sort((a, b) => appCapabilityKey(a) < appCapabilityKey(b) ? -1 : appCapabilityKey(a) > appCapabilityKey(b) ? 1 : 0);
		command.approval.bindings.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
		command.approval.attribution?.representations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	}
	const requestDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return tx.transaction(async work => {
		const authorize = async () => admit((await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted);
		await authorize();
		const [candidate] = await work.select({ workloadId: connectedInstallation.workloadPrincipalId }).from(connectedInstallation)
			.where(and(eq(connectedInstallation.id, command.installationId), eq(connectedInstallation.ownerScopeId, command.ownerScopeId))).limit(1);
		const workloadId = candidate?.workloadId ?? (command.operation === "prepare" ? command.workloadPrincipalId : null);
		if (!workloadId) throw new InstallationConflict();
		const [workload] = await work.select({ id: users.id }).from(users).where(eq(users.id, workloadId)).for("update");
		if (!workload) throw new InstallationUnavailable();
		await authorize();
		if (command.operation === "prepare") await work.insert(connectedInstallation).values({ id: command.installationId, appId: command.appId,
			ownerScopeId: command.ownerScopeId, workloadPrincipalId: command.workloadPrincipalId }).onConflictDoNothing({ target: connectedInstallation.id });
		const [head] = await work.select().from(connectedInstallation).where(and(eq(connectedInstallation.id, command.installationId), eq(connectedInstallation.ownerScopeId, command.ownerScopeId))).for("update");
		if (!head) throw new InstallationConflict();
		if (command.operation === "prepare" && (head.appId !== command.appId || head.workloadPrincipalId !== command.workloadPrincipalId)) throw new InstallationConflict();
		await authorize();
		const [prior] = await work.select().from(connectedInstallationEvent).where(and(eq(connectedInstallationEvent.installationId, head.id), eq(connectedInstallationEvent.operationId, command.operationId))).limit(1);
		if (prior) {
			if (prior.requestDigest !== requestDigest) throw new InstallationConflict();
			return receipt(prior);
		}
		if (head.state === "revoked" || head.version !== command.expectedVersion || (command.operation === "prepare") !== (head.state === "draft")) throw new InstallationConflict();
		const nextVersion = head.version + 1;
		if (!Number.isSafeInteger(nextVersion)) throw new InstallationUnavailable();
		let state: InstallationReceipt["state"] = head.state === "draft" ? "pending" : head.state;
		let epoch = head.credentialEpoch;
		if (command.operation === "prepare") epoch = 1;
		else if (command.operation === "approve") { state = "active"; epoch++; }
		else if (command.operation === "suspend") {
			if (head.state !== "active") throw new InstallationConflict();
			state = "suspended"; epoch++;
		} else if (command.operation === "resume") {
			if (head.state !== "suspended") throw new InstallationConflict();
			state = "active";
		} else if (command.operation === "revoke") { state = "revoked"; epoch++; }
		const approvedRevision = command.operation === "approve" ? nextVersion : head.approvedRevision;
		const [event] = await work.insert(connectedInstallationEvent).values({ installationId: head.id, version: nextVersion,
			operationId: command.operationId, requestDigest, operation: command.operation, stateAfter: state, credentialEpochAfter: epoch,
			retainedApprovedRevision: command.operation === "approve" || command.operation === "prepare" ? null : head.approvedRevision,
			operatorAuthUserId: command.operatorAuthUserId, authoritySubjectId: command.authoritySubjectId }).returning();
		if (!event) throw new InstallationUnavailable();
		if (command.operation === "approve") {
			const { capabilities, bindings, attribution, ...terms } = command.approval;
			const representations = attribution?.representations ?? [];
			await work.insert(connectedInstallationRevision).values({ installationId: head.id, revision: nextVersion, appId: head.appId, ...terms,
				capabilityCount: capabilities.length, capabilityDigest: appCapabilityDigest(capabilities), bindingCount: bindings.length,
				bindingDigest: installationReferenceDigest(bindings), attributionEntityId: attribution?.entityId ?? null,
				attributionCount: representations.length, attributionDigest: installationReferenceDigest(representations) });
			if (capabilities.length) await work.insert(connectedInstallationCapability).values(capabilities.map(value => ({ installationId: head.id, revision: nextVersion, family: value.family, capability: value.key })));
			if (bindings.length) await work.insert(connectedInstallationBinding).values(bindings.map(value => ({ installationId: head.id, revision: nextVersion, bindingId: value.id, termsRevision: value.revision })));
			if (representations.length) await work.insert(connectedInstallationAttribution).values(representations.map(value => ({ installationId: head.id, revision: nextVersion, grantId: value.id, termsRevision: value.revision })));
			await work.update(connectedInstallationRevision).set({ sealed: true }).where(and(eq(connectedInstallationRevision.installationId, head.id), eq(connectedInstallationRevision.revision, nextVersion)));
		}
		const result = (await work.execute<{ admitted: boolean | null; changed: string | null }>(sql`
			with admission as materialized(select (${admission}) as admitted),changed as (
			 update public.connected_installation set version=${nextVersion},credential_epoch=${epoch},state=${state},approved_revision=${approvedRevision}::bigint
			 where id=${head.id}::uuid and version=${head.version} and(select admitted from admission) is true returning id
			) select(select admitted from admission) as admitted,(select id from changed) as changed`)).rows[0];
		admit(result?.admitted);
		if (!result?.changed) throw new InstallationConflict();
		return receipt(event);
	});
}

/** Load a complete immutable approval; callers still verify current installation, grants, attribution and credential limits. @internal */
export async function readInstallationApproval(tx: DatabaseTransaction, input: { installationId: string; revision: number }) {
	const request = z.strictObject({ installationId: id, revision: version.min(1) }).parse(input);
	const [terms] = await tx.select().from(connectedInstallationRevision).where(and(eq(connectedInstallationRevision.installationId, request.installationId),
		eq(connectedInstallationRevision.revision, request.revision), eq(connectedInstallationRevision.sealed, true))).limit(1);
	if (!terms) return null;
	const capabilities = await tx.select({ family: connectedInstallationCapability.family, capability: connectedInstallationCapability.capability }).from(connectedInstallationCapability)
		.where(and(eq(connectedInstallationCapability.installationId, request.installationId), eq(connectedInstallationCapability.revision, request.revision)))
		.orderBy(sql`${connectedInstallationCapability.family} collate "C"`, sql`${connectedInstallationCapability.capability} collate "C"`).limit(MaximumAppCapabilities + 1);
	const bindings = await tx.select({ id: connectedInstallationBinding.bindingId, revision: connectedInstallationBinding.termsRevision }).from(connectedInstallationBinding)
		.where(and(eq(connectedInstallationBinding.installationId, request.installationId), eq(connectedInstallationBinding.revision, request.revision))).orderBy(connectedInstallationBinding.bindingId).limit(65);
	const attribution = await tx.select({ id: connectedInstallationAttribution.grantId, revision: connectedInstallationAttribution.termsRevision }).from(connectedInstallationAttribution)
		.where(and(eq(connectedInstallationAttribution.installationId, request.installationId), eq(connectedInstallationAttribution.revision, request.revision))).orderBy(connectedInstallationAttribution.grantId).limit(9);
	if (bindings.length > 64 || bindings.length !== terms.bindingCount || installationReferenceDigest(bindings) !== terms.bindingDigest ||
		attribution.length > 8 || attribution.length !== terms.attributionCount || installationReferenceDigest(attribution) !== terms.attributionDigest ||
		(terms.attributionEntityId === null) !== (attribution.length === 0)) throw new InstallationUnavailable();
	return { ...terms, capabilities: decodeAppCapabilities(capabilities, terms.capabilityCount, terms.capabilityDigest), bindings,
		attribution: terms.attributionEntityId ? { entityId: terms.attributionEntityId, representations: attribution } : null };
}
