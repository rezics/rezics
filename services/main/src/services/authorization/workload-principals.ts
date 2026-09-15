import { createHash } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { users } from "../database/schema/auth";
import { workloadPrincipal, workloadPrincipalEvent } from "../database/schema/workload-principal";
import { accessScope, accessSubject } from "../database/schema/access-identity";
import { allocateAccessSubject } from "./identities";
import { readAccessSubjectEligibility } from "./subject-eligibility";

/** Private duty keys bind trusted platform code to stable service actors, never to a remote claim. @internal */
export const PlatformWorkloadDefinitions = {
	"account-erasure": "Account erasure",
	"cimd-registry": "CIMD registry",
	"webhook-delivery": "Webhook delivery",
} as const;

const id = z.uuid().toLowerCase(), version = z.number().int().nonnegative().safe();
const label = z.string().min(1).max(512).refine(value => value.trim().length > 0 && Buffer.byteLength(value, "utf8") <= 512);
const base = { principalId: id, ownerScopeId: id, operationId: id, expectedVersion: version, operatorAuthUserId: id, authoritySubjectId: id };
const schema = z.discriminatedUnion("operation", [
	z.strictObject({ ...base, operation: z.literal("create"), expectedVersion: z.literal(0), label,
		purpose: z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("installation") }),
			z.strictObject({ kind: z.literal("system"), key: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/) })]) }),
	z.strictObject({ ...base, operation: z.literal("rename"), label }),
	z.strictObject({ ...base, operation: z.enum(["suspend", "resume", "revoke"]) }),
]);
/** Internal scope-owned workload intent; public callers never choose an arbitrary service principal identity. @internal */
export type WorkloadPrincipalCommand = z.infer<typeof schema>;
/** Stable original outcome; the private principal ID is not an external OAuth subject. @internal */
export interface WorkloadPrincipalReceipt {
	principalId: string; operationId: string; version: number; credentialEpoch: number; state: "active" | "suspended" | "revoked";
}
/** Stale lifecycle, immutable owner or different replay intent. @internal */
export class WorkloadPrincipalConflict extends Error {
	constructor() { super("Workload command conflicts with current state or its receipt"); }
}
/** Current scope/installation or platform-duty admission denied this operation. @internal */
export class WorkloadPrincipalDenied extends Error {
	constructor() { super("Current workload authority is required"); }
}
/** Missing authoritative policy cannot become a workload allow. @internal */
export class WorkloadPrincipalUnavailable extends Error {
	constructor() { super("Workload state or authority is unavailable"); }
}
function admit(value: boolean | null | undefined) {
	if (value === false) throw new WorkloadPrincipalDenied();
	if (value !== true) throw new WorkloadPrincipalUnavailable();
}
function receipt(event: typeof workloadPrincipalEvent.$inferSelect): WorkloadPrincipalReceipt {
	return { principalId: event.authUserId, operationId: event.operationId, version: event.version,
		credentialEpoch: event.credentialEpochAfter, state: event.stateAfter };
}

/**
 * Admit a private workload or change its lifecycle under current owner SQL.
 * @internal
 * @remarks The caller creates the service account in the same transaction and
 * admits the exact installation/platform purpose. Installation workloads start
 * suspended; activation separately requires the admitted installation and scope.
 * The historical operator never becomes a revocation dependency. Complete
 * overlapping authority fences must be promoted before entering this primitive.
 */
export async function applyWorkloadPrincipalCommand(tx: DatabaseTransaction, input: WorkloadPrincipalCommand, admission: SQL<boolean | null>): Promise<WorkloadPrincipalReceipt> {
	const command = schema.parse(input);
	const requestDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return tx.transaction(async work => {
		const authorize = async () => admit((await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted);
		await authorize();
		const [account] = await work.select({ kind: users.principalKind, erasedAt: users.erasedAt }).from(users)
			.where(eq(users.id, command.principalId)).for("update");
		if (!account || account.kind !== "service" || (account.erasedAt !== null && command.operation !== "revoke")) throw new WorkloadPrincipalConflict();
		await authorize();
		if (command.operation === "create") {
			await allocateAccessSubject(work, { kind: "principal", id: command.principalId });
			await work.insert(workloadPrincipal).values({ authUserId: command.principalId,
				ownerScopeId: command.ownerScopeId, purpose: command.purpose.kind, systemKey: command.purpose.kind === "system" ? command.purpose.key : null })
				.onConflictDoNothing({ target: workloadPrincipal.authUserId });
		}
		const [head] = await work.select().from(workloadPrincipal).where(and(eq(workloadPrincipal.authUserId, command.principalId), eq(workloadPrincipal.ownerScopeId, command.ownerScopeId))).for("update");
		if (!head) throw new WorkloadPrincipalConflict();
		await authorize();
		const [prior] = await work.select().from(workloadPrincipalEvent).where(and(eq(workloadPrincipalEvent.authUserId, head.authUserId), eq(workloadPrincipalEvent.operationId, command.operationId))).limit(1);
		if (prior) {
			if (prior.requestDigest !== requestDigest) throw new WorkloadPrincipalConflict();
			return receipt(prior);
		}
		if (head.version !== command.expectedVersion || head.state === "revoked" || (command.operation === "create") !== (head.state === "draft")) throw new WorkloadPrincipalConflict();
		const nextVersion = head.version + 1;
		if (!Number.isSafeInteger(nextVersion)) throw new WorkloadPrincipalUnavailable();
		let state: WorkloadPrincipalReceipt["state"] = head.state === "draft" ? head.purpose === "system" ? "active" : "suspended" : head.state;
		let epoch = head.credentialEpoch;
		if (command.operation === "create") epoch = 1;
		else if (command.operation === "suspend") {
			if (head.state !== "active") throw new WorkloadPrincipalConflict();
			state = "suspended"; epoch++;
		} else if (command.operation === "resume") {
			if (head.state !== "suspended") throw new WorkloadPrincipalConflict();
			state = "active";
		} else if (command.operation === "revoke") { state = "revoked"; epoch++; }
		const [previous] = head.version ? await work.select({ label: workloadPrincipalEvent.label }).from(workloadPrincipalEvent)
			.where(and(eq(workloadPrincipalEvent.authUserId, head.authUserId), eq(workloadPrincipalEvent.version, head.version))).limit(1) : [];
		const nextLabel = command.operation === "create" || command.operation === "rename" ? command.label : previous?.label;
		if (!nextLabel) throw new WorkloadPrincipalUnavailable();
		const [event] = await work.insert(workloadPrincipalEvent).values({ authUserId: head.authUserId, version: nextVersion,
			operationId: command.operationId, requestDigest, operation: command.operation, stateAfter: state, credentialEpochAfter: epoch,
			label: nextLabel, operatorAuthUserId: command.operatorAuthUserId, authoritySubjectId: command.authoritySubjectId }).returning();
		if (!event) throw new WorkloadPrincipalUnavailable();
		const result = (await work.execute<{ admitted: boolean | null; changed: string | null }>(sql`
			with admission as materialized(select (${admission}) as admitted),changed as (
			 update public.workload_principal set version=${nextVersion},credential_epoch=${epoch},state=${state}
			 where auth_user_id=${head.authUserId}::uuid and version=${head.version} and(select admitted from admission) is true returning auth_user_id
			) select(select admitted from admission) as admitted,(select auth_user_id from changed) as changed`)).rows[0];
		admit(result?.admitted);
		if (!result?.changed) throw new WorkloadPrincipalConflict();
		return receipt(event);
	});
}

/**
 * Resolve an installed platform duty and retain its current execution policy.
 * @internal
 * @remarks Only trusted duty implementations call this function. It does not
 * authenticate an external caller or permit arbitrary work merely by naming a key.
 * The duty adds its operation-specific target/claim admission before effects.
 */
export async function readPlatformWorkload(tx: DatabaseTransaction, key: keyof typeof PlatformWorkloadDefinitions) {
	if (!Object.hasOwn(PlatformWorkloadDefinitions, key)) throw new WorkloadPrincipalUnavailable();
	const [candidate] = await tx.select({ principalId: workloadPrincipal.authUserId }).from(workloadPrincipal)
		.where(eq(workloadPrincipal.systemKey, key)).limit(1);
	if (!candidate) throw new WorkloadPrincipalUnavailable();
	const [account] = await tx.select({ kind: users.principalKind, erasedAt: users.erasedAt }).from(users)
		.where(eq(users.id, candidate.principalId)).for("share");
	if (!account || account.kind !== "service" || account.erasedAt !== null) throw new WorkloadPrincipalDenied();
	const [head] = await tx.select().from(workloadPrincipal).where(eq(workloadPrincipal.authUserId, candidate.principalId)).limit(1);
	if (!head || head.purpose !== "system" || head.systemKey !== key || head.version < 1) throw new WorkloadPrincipalUnavailable();
	if (head.state !== "active") throw new WorkloadPrincipalDenied();
	const [scope] = await tx.select({ root: accessScope.platformRoot }).from(accessScope).where(eq(accessScope.id, head.ownerScopeId)).limit(1);
	const [subject] = await tx.select({ id: accessSubject.id }).from(accessSubject).where(eq(accessSubject.authUserId, head.authUserId)).limit(1);
	if (scope?.root !== "platform" || !subject) throw new WorkloadPrincipalUnavailable();
	const [eligibility] = await readAccessSubjectEligibility(tx, { subjectIds: [subject.id], action: "write" });
	if (eligibility?.outcome === "deny") throw new WorkloadPrincipalDenied();
	if (eligibility?.outcome !== "allow") throw new WorkloadPrincipalUnavailable();
	const admission = sql<boolean>`exists(select 1 from public.workload_principal w join public.access_scope s on s.id=w.owner_scope_id
		where w.auth_user_id=${head.authUserId}::uuid and w.system_key=${key} and w.purpose='system' and s.platform_root='platform'
		and w.version=${head.version} and w.credential_epoch=${head.credentialEpoch} and w.state='active')
		and public.access_subject_is_eligible(${subject.id}::uuid,'write') is true`;
	return { principalId: head.authUserId, subjectId: subject.id, ownerScopeId: head.ownerScopeId,
		version: head.version, credentialEpoch: head.credentialEpoch, admission };
}
