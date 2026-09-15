import { createHash } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { connectedAppClient, connectedAppClientCapability, connectedAppClientEvent, connectedAppClientRevision } from "../database/schema/connected-app-client";
import { oauthClientAuthority } from "../database/schema/oauth-client-authority";
import { AppCapabilitySchema, MaximumAppCapabilities, appCapabilityDigest, appCapabilityKey, decodeAppCapabilities } from "./capabilities";

const id = z.uuid().toLowerCase(), version = z.number().int().nonnegative().safe();
/** Explicit prospective client ceiling; its members are never inferred from a mutable App head. @internal */
export const AppClientTermsSchema = z.strictObject({
	appRevision: version.min(1), protocolCredentialEpoch: version,
	offlineAccess: z.boolean(), entityDisclosure: z.boolean(),
	capabilities: z.array(AppCapabilitySchema).max(MaximumAppCapabilities).refine(values => new Set(values.map(appCapabilityKey)).size === values.length),
});
const base = { clientId: id, appId: id, operationId: id, expectedVersion: version, operatorAuthUserId: id, authoritySubjectId: id };
const commandSchema = z.discriminatedUnion("operation", [
	z.strictObject({ ...base, operation: z.literal("admit"), expectedVersion: z.literal(0),
		usage: z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("user") }),
			z.strictObject({ kind: z.literal("installation"), workloadPrincipalId: id })]), terms: AppClientTermsSchema }),
	z.strictObject({ ...base, operation: z.literal("revise"), terms: AppClientTermsSchema }),
	z.strictObject({ ...base, operation: z.enum(["disable", "enable", "revoke"]) }),
]);
/** Server-owned App/client admission or control, after publisher/installation or curated discovery policy. @internal */
export type AppClientCommand = z.infer<typeof commandSchema>;
/** Original private client admission outcome; IDs are not authentication proofs. @internal */
export interface AppClientReceipt {
	clientId: string; operationId: string; version: number; termsRevision: number;
	credentialEpoch: number; state: "active" | "disabled" | "revoked";
}
/** Stale state, incompatible client usage or a different replay intent. @internal */
export class AppClientConflict extends Error {
	constructor() { super("Client admission conflicts with current state or its receipt"); }
}
/** Current App/client or installation policy rejected the operation. @internal */
export class AppClientDenied extends Error {
	constructor() { super("Current client admission authority is required"); }
}
/** Missing or incomplete current client policy cannot become an allow. @internal */
export class AppClientUnavailable extends Error {
	constructor() { super("Client admission is unavailable"); }
}
function admit(value: boolean | null | undefined) {
	if (value === false) throw new AppClientDenied();
	if (value !== true) throw new AppClientUnavailable();
}
function receipt(event: typeof connectedAppClientEvent.$inferSelect): AppClientReceipt {
	const termsRevision = event.operation === "admit" || event.operation === "revise" ? event.version : event.retainedTermsRevision;
	if (termsRevision === null) throw new AppClientUnavailable();
	return { clientId: event.clientId, operationId: event.operationId, version: event.version, termsRevision,
		credentialEpoch: event.credentialEpochAfter, state: event.stateAfter };
}

/**
 * Admit a protocol client without treating registration as user consent or machine privilege.
 * @internal
 * @remarks The caller separately proves current App/publisher or exact installation
 * authority, protocol configuration and any credential assurance. Installation
 * clients start disabled. Their immutable workload choice prevents caller-selected
 * installation substitution; later enablement must include installation policy.
 * Native terms seal a literal subset of an exact App declaration and protocol epoch.
 */
export async function applyAppClientCommand(tx: DatabaseTransaction, input: AppClientCommand, admission: SQL<boolean | null>): Promise<AppClientReceipt> {
	const command = commandSchema.parse(input);
	if (command.operation === "admit" || command.operation === "revise")
		command.terms.capabilities.sort((a, b) => appCapabilityKey(a) < appCapabilityKey(b) ? -1 : appCapabilityKey(a) > appCapabilityKey(b) ? 1 : 0);
	const requestDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return tx.transaction(async work => {
		const authorize = async () => admit((await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted);
		await authorize();
		const [fence] = await work.select().from(oauthClientAuthority).where(eq(oauthClientAuthority.id, command.clientId)).for("update");
		if (!fence) throw new AppClientUnavailable();
		if (fence.revokedAt !== null && command.operation !== "disable" && command.operation !== "revoke") throw new AppClientDenied();
		if ((command.operation === "admit" || command.operation === "revise") && command.terms.protocolCredentialEpoch !== fence.credentialEpoch) throw new AppClientConflict();
		await authorize();
		if (command.operation === "admit") await work.insert(connectedAppClient).values({ clientId: command.clientId, appId: command.appId,
			kind: command.usage.kind, workloadPrincipalId: command.usage.kind === "installation" ? command.usage.workloadPrincipalId : null })
			.onConflictDoNothing({ target: connectedAppClient.clientId });
		const [head] = await work.select().from(connectedAppClient).where(and(eq(connectedAppClient.clientId, command.clientId), eq(connectedAppClient.appId, command.appId))).for("update");
		if (!head) throw new AppClientConflict();
		await authorize();
		const [prior] = await work.select().from(connectedAppClientEvent).where(and(eq(connectedAppClientEvent.clientId, head.clientId), eq(connectedAppClientEvent.operationId, command.operationId))).limit(1);
		if (prior) {
			if (prior.requestDigest !== requestDigest) throw new AppClientConflict();
			return receipt(prior);
		}
		if (head.state === "revoked" || head.version !== command.expectedVersion || (command.operation === "admit") !== (head.state === "draft")) throw new AppClientConflict();
		const nextVersion = head.version + 1;
		if (!Number.isSafeInteger(nextVersion)) throw new AppClientUnavailable();
		let state: AppClientReceipt["state"] = head.state === "draft" ? head.kind === "user" ? "active" : "disabled" : head.state;
		let epoch = head.credentialEpoch;
		if (command.operation === "admit") epoch = 1;
		else if (command.operation === "disable") {
			if (head.state !== "active") throw new AppClientConflict();
			state = "disabled"; epoch++;
		} else if (command.operation === "enable") {
			if (head.state !== "disabled") throw new AppClientConflict();
			state = "active";
		} else if (command.operation === "revoke") { state = "revoked"; epoch++; }
		const termsRevision = command.operation === "admit" || command.operation === "revise" ? nextVersion : head.termsRevision;
		if (termsRevision === null) throw new AppClientUnavailable();
		const [event] = await work.insert(connectedAppClientEvent).values({ clientId: head.clientId, version: nextVersion,
			operationId: command.operationId, requestDigest, operation: command.operation, stateAfter: state, credentialEpochAfter: epoch,
			retainedTermsRevision: command.operation === "admit" || command.operation === "revise" ? null : head.termsRevision,
			operatorAuthUserId: command.operatorAuthUserId, authoritySubjectId: command.authoritySubjectId }).returning();
		if (!event) throw new AppClientUnavailable();
		if (command.operation === "admit" || command.operation === "revise") {
			const { capabilities, ...terms } = command.terms;
			await work.insert(connectedAppClientRevision).values({ clientId: head.clientId, revision: nextVersion, appId: head.appId, ...terms,
				capabilityCount: capabilities.length, capabilityDigest: appCapabilityDigest(capabilities) });
			if (capabilities.length) await work.insert(connectedAppClientCapability).values(capabilities.map(value => ({
				clientId: head.clientId, revision: nextVersion, family: value.family, capability: value.key,
			})));
			await work.update(connectedAppClientRevision).set({ sealed: true }).where(and(eq(connectedAppClientRevision.clientId, head.clientId), eq(connectedAppClientRevision.revision, nextVersion)));
		}
		const result = (await work.execute<{ admitted: boolean | null; changed: string | null }>(sql`
			with admission as materialized(select (${admission}) as admitted),changed as (
			 update public.connected_app_client set version=${nextVersion},terms_revision=${termsRevision},state=${state},credential_epoch=${epoch}
			 where client_id=${head.clientId}::uuid and version=${head.version} and(select admitted from admission) is true returning client_id
			) select(select admitted from admission) as admitted,(select client_id from changed) as changed`)).rows[0];
		admit(result?.admitted);
		if (!result?.changed) throw new AppClientConflict();
		return receipt(event);
	});
}

/** Read one complete client ceiling; it is not proof of live client, consent, installation or resource access. @internal */
export async function readAppClientTerms(tx: DatabaseTransaction, input: { clientId: string; revision: number }) {
	const request = z.strictObject({ clientId: id, revision: version.min(1) }).parse(input);
	const [terms] = await tx.select().from(connectedAppClientRevision).where(and(eq(connectedAppClientRevision.clientId, request.clientId),
		eq(connectedAppClientRevision.revision, request.revision), eq(connectedAppClientRevision.sealed, true))).limit(1);
	if (!terms) return null;
	const rows = await tx.select({ family: connectedAppClientCapability.family, capability: connectedAppClientCapability.capability }).from(connectedAppClientCapability)
		.where(and(eq(connectedAppClientCapability.clientId, request.clientId), eq(connectedAppClientCapability.revision, request.revision)))
		.orderBy(sql`${connectedAppClientCapability.family} collate "C"`, sql`${connectedAppClientCapability.capability} collate "C"`).limit(MaximumAppCapabilities + 1);
	return { ...terms, capabilities: decodeAppCapabilities(rows, terms.capabilityCount, terms.capabilityDigest) };
}
