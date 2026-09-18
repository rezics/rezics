import { createHash } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { connectedApp, connectedAppCapability, connectedAppEvent, connectedAppRevision } from "@rezics/schema/postgres/integrations/connected-app";
import { AppDefinitionSchema, MaximumAppCapabilities, appCapabilityDigest, appCapabilityKey, decodeAppCapabilities } from "./capabilities";

const id = z.uuid().toLowerCase(), version = z.number().int().nonnegative().safe();
const base = { appId: id, scopeId: id, operationId: id, expectedVersion: version, operatorAuthUserId: id, authoritySubjectId: id };
const commandSchema = z.discriminatedUnion("operation", [
	z.strictObject({ ...base, operation: z.literal("create"), expectedVersion: z.literal(0), definition: AppDefinitionSchema }),
	z.strictObject({ ...base, operation: z.literal("revise"), definition: AppDefinitionSchema }),
	z.strictObject({ ...base, operation: z.enum(["disable", "enable", "retire"]) }),
	z.strictObject({ ...base, operation: z.literal("set-trust"), trust: z.enum(["unreviewed", "trusted", "blocked"]) }),
]);
/** Control intent with exact audit attribution; admission remains a separate current owner predicate. @internal */
export type ConnectedAppCommand = z.infer<typeof commandSchema>;
/** Immutable command outcome, not a live credential or approval. @internal */
export interface ConnectedAppReceipt {
	appId: string; operationId: string; version: number; declaredRevision: number;
	state: "active" | "disabled" | "retired"; trust: "unreviewed" | "trusted" | "blocked"; authorityEpoch: number;
}
/** Conflicting intent, state or optimistic precondition. @internal */
export class ConnectedAppConflict extends Error {
	constructor() { super("App command conflicts with current state or its receipt"); }
}
/** Current publisher/platform policy rejected the requested operation. @internal */
export class ConnectedAppDenied extends Error {
	constructor() { super("Current App operation authority is required"); }
}
/** Incomplete current evidence cannot authorize an App operation. @internal */
export class ConnectedAppUnavailable extends Error {
	constructor() { super("App state or authority is unavailable"); }
}
function admit(value: boolean | null | undefined) {
	if (value === false) throw new ConnectedAppDenied();
	if (value !== true) throw new ConnectedAppUnavailable();
}
function receipt(event: typeof connectedAppEvent.$inferSelect): ConnectedAppReceipt {
	const declaredRevision = event.operation === "create" || event.operation === "revise" ? event.version : event.retainedDeclaredRevision;
	if (declaredRevision === null) throw new ConnectedAppUnavailable();
	return { appId: event.appId, operationId: event.operationId, version: event.version, declaredRevision,
		state: event.stateAfter, trust: event.trustAfter, authorityEpoch: event.authorityEpochAfter };
}

/**
 * Persist App declarations/lifecycle under current publisher or separate platform trust admission.
 * @internal
 * @remarks Declarations are not consent or installation approval. Disable/block/
 * retirement advance credential invalidation independently from declaration edits.
 * The caller retains complete authority fences and supplies operation-specific SQL;
 * private actor metadata alone never authorizes a trust or publisher transition.
 */
export async function applyConnectedAppCommand(tx: DatabaseTransaction, input: ConnectedAppCommand, admission: SQL<boolean | null>): Promise<ConnectedAppReceipt> {
	const command = commandSchema.parse(input);
	if (command.operation === "create" || command.operation === "revise")
		command.definition.capabilities.sort((a, b) => appCapabilityKey(a) < appCapabilityKey(b) ? -1 : appCapabilityKey(a) > appCapabilityKey(b) ? 1 : 0);
	const requestDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return tx.transaction(async work => {
		const authorize = async () => admit((await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted);
		await authorize();
		if (command.operation === "create") await work.insert(connectedApp).values({ id: command.appId, scopeId: command.scopeId })
			.onConflictDoNothing({ target: connectedApp.id });
		const [head] = await work.select().from(connectedApp).where(and(eq(connectedApp.id, command.appId), eq(connectedApp.scopeId, command.scopeId))).for("update");
		if (!head) throw new ConnectedAppConflict();
		await authorize();
		const [prior] = await work.select().from(connectedAppEvent).where(and(eq(connectedAppEvent.appId, head.id), eq(connectedAppEvent.operationId, command.operationId))).limit(1);
		if (prior) {
			if (prior.requestDigest !== requestDigest) throw new ConnectedAppConflict();
			return receipt(prior);
		}
		if (head.version !== command.expectedVersion || head.state === "retired" || (command.operation === "create") !== (head.state === "draft"))
			throw new ConnectedAppConflict();
		const nextVersion = head.version + 1;
		if (!Number.isSafeInteger(nextVersion)) throw new ConnectedAppUnavailable();
		let state: ConnectedAppReceipt["state"] = head.state === "draft" ? "active" : head.state;
		let trust = head.trust, authorityEpoch = head.authorityEpoch;
		if (command.operation === "create") authorityEpoch = 1;
		else if (command.operation === "disable") {
			if (head.state !== "active") throw new ConnectedAppConflict();
			state = "disabled"; authorityEpoch++;
		} else if (command.operation === "enable") {
			if (head.state !== "disabled" || head.trust === "blocked") throw new ConnectedAppConflict();
			state = "active";
		} else if (command.operation === "retire") { state = "retired"; authorityEpoch++; }
		else if (command.operation === "set-trust") {
			if (head.trust === command.trust) throw new ConnectedAppConflict();
			trust = command.trust;
			if (trust === "blocked") { state = "disabled"; authorityEpoch++; }
		}
		const declaredRevision = command.operation === "create" || command.operation === "revise" ? nextVersion : head.declaredRevision;
		if (declaredRevision === null) throw new ConnectedAppUnavailable();
		const [event] = await work.insert(connectedAppEvent).values({ appId: head.id, version: nextVersion, operationId: command.operationId,
			requestDigest, operation: command.operation, stateAfter: state, trustAfter: trust, authorityEpochAfter: authorityEpoch,
			retainedDeclaredRevision: command.operation === "create" || command.operation === "revise" ? null : head.declaredRevision,
			operatorAuthUserId: command.operatorAuthUserId, authoritySubjectId: command.authoritySubjectId }).returning();
		if (!event) throw new ConnectedAppUnavailable();
		if (command.operation === "create" || command.operation === "revise") {
			const { capabilities, ...definition } = command.definition;
			await work.insert(connectedAppRevision).values({ appId: head.id, revision: nextVersion, ...definition,
				capabilityCount: capabilities.length, capabilityDigest: appCapabilityDigest(capabilities) });
			if (capabilities.length) await work.insert(connectedAppCapability).values(capabilities.map(value => ({
				appId: head.id, revision: nextVersion, family: value.family, capability: value.key,
			})));
			await work.update(connectedAppRevision).set({ sealed: true }).where(and(eq(connectedAppRevision.appId, head.id), eq(connectedAppRevision.revision, nextVersion)));
		}
		const result = (await work.execute<{ admitted: boolean | null; changed: string | null }>(sql`
			with admission as materialized(select (${admission}) as admitted),changed as (
			 update public.connected_app set version=${nextVersion},declared_revision=${declaredRevision},state=${state},trust=${trust},authority_epoch=${authorityEpoch}
			 where id=${head.id}::uuid and version=${head.version} and(select admitted from admission) is true returning id
			) select(select admitted from admission) as admitted,(select id from changed) as changed`)).rows[0];
		admit(result?.admitted);
		if (!result?.changed) throw new ConnectedAppConflict();
		return receipt(event);
	});
}

/** Read a complete immutable declaration; current App policy, approval and disclosure remain caller-owned. @internal */
export async function readConnectedAppDefinition(tx: DatabaseTransaction, input: { appId: string; revision: number | "declared" }) {
	const appId = id.parse(input.appId);
	if (input.revision !== "declared") version.min(1).parse(input.revision);
	const query = tx.select().from(connectedApp).where(eq(connectedApp.id, appId));
	const [head] = input.revision === "declared" ? await query.for("share") : await query;
	if (!head) return null;
	const revision = input.revision === "declared" ? head.declaredRevision : input.revision;
	if (revision === null) return null;
	const [definition] = await tx.select().from(connectedAppRevision).where(and(eq(connectedAppRevision.appId, appId),
		eq(connectedAppRevision.revision, revision), eq(connectedAppRevision.sealed, true))).limit(1);
	if (!definition) return null;
	const rows = await tx.select({ family: connectedAppCapability.family, capability: connectedAppCapability.capability }).from(connectedAppCapability)
		.where(and(eq(connectedAppCapability.appId, appId), eq(connectedAppCapability.revision, revision)))
		.orderBy(sql`${connectedAppCapability.family} collate "C"`, sql`${connectedAppCapability.capability} collate "C"`).limit(MaximumAppCapabilities + 1);
	return { head, definition: { ...definition, capabilities: decodeAppCapabilities(rows, definition.capabilityCount, definition.capabilityDigest) } };
}
