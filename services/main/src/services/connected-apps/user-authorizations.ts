import { createHash } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { users } from "@rezics/schema/postgres/identity/auth";
import { connectedUserConnection, connectedUserConnectionEvent, connectedUserConsent, connectedUserConsentCapability,
	connectedUserConsentEvent, connectedUserConsentRepresentation, connectedUserConsentResource, connectedUserConsentRevision } from "@rezics/schema/postgres/integrations/connected-user-authorization";
import { AppCapabilitySchema, MaximumAppCapabilities, appCapabilityDigest, appCapabilityKey, decodeAppCapabilities } from "./capabilities";

const id = z.uuid().toLowerCase(), version = z.number().int().nonnegative().safe();
const representation = z.strictObject({ id, revision: version.min(1) });
const resource = z.strictObject({ scopeId: id, path: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,255}$/)).max(8)
	.refine(value => Buffer.byteLength(value.join("/"), "utf8") <= 2048) });
function resourceKey(value: z.infer<typeof resource>) { return `${value.scopeId}:${value.path.join("/")}`; }
const digest = (values: readonly string[]) => createHash("sha256").update([...values].sort().join("\n")).digest("hex");
/** Finite user approval; all-scopes is explicit and never inferred from an empty selection. @internal */
export const UserConsentTermsSchema = z.strictObject({
	clientTermsRevision: version.min(1), validFrom: z.date(), validUntil: z.date(), offlineAccess: z.boolean(), entityDisclosure: z.boolean(),
	capabilities: z.array(AppCapabilitySchema).max(MaximumAppCapabilities).refine(values => new Set(values.map(appCapabilityKey)).size === values.length),
	resources: z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("all-scopes") }),
		z.strictObject({ kind: z.literal("selected"), values: z.array(resource).min(1).max(64).refine(values => new Set(values.map(resourceKey)).size === values.length) })]),
	representations: z.array(representation).max(8).refine(values => new Set(values.map(value => value.id)).size === values.length),
}).refine(value => value.validUntil > value.validFrom && value.validUntil.getTime() - value.validFrom.getTime() <= 365 * 86_400_000);
const connectionBase = { connectionId: id, authUserId: id, operationId: id, expectedVersion: version };
const connectionSchema = z.discriminatedUnion("operation", [
	z.strictObject({ ...connectionBase, operation: z.literal("connect"), expectedVersion: z.literal(0), clientId: id, subjectId: id }),
	z.strictObject({ ...connectionBase, operation: z.literal("disconnect") }),
]);
const consentBase = { consentId: id, connectionId: id, authUserId: id, operationId: id, expectedVersion: version };
const consentSchema = z.discriminatedUnion("operation", [
	z.strictObject({ ...consentBase, operation: z.literal("grant"), expectedVersion: z.literal(0), terms: UserConsentTermsSchema }),
	z.strictObject({ ...consentBase, operation: z.literal("revise"), terms: UserConsentTermsSchema }),
	z.strictObject({ ...consentBase, operation: z.literal("revoke") }),
]);
/** Private user/client/subject association; the caller supplies current user and subject-selection admission. @internal */
export type UserConnectionCommand = z.infer<typeof connectionSchema>;
/** Explicit consent intent, independently admitted from an installation or Org decision. @internal */
export type UserConsentCommand = z.infer<typeof consentSchema>;
/** Stale state, an immutable association or different replay intent. @internal */
export class UserAuthorizationConflict extends Error {
	constructor() { super("User authorization conflicts with current state or its receipt"); }
}
/** Current user/representation policy rejected the operation. @internal */
export class UserAuthorizationDenied extends Error {
	constructor() { super("Current user authorization is required"); }
}
/** Missing or incomplete current user authorization cannot become consent. @internal */
export class UserAuthorizationUnavailable extends Error {
	constructor() { super("User authorization is unavailable"); }
}
function admit(value: boolean | null | undefined) {
	if (value === false) throw new UserAuthorizationDenied();
	if (value !== true) throw new UserAuthorizationUnavailable();
}
async function lockUser(tx: DatabaseTransaction, authUserId: string) {
	const [user] = await tx.select({ kind: users.principalKind, erasedAt: users.erasedAt }).from(users).where(eq(users.id, authUserId)).for("update");
	if (!user || user.kind !== "human" || user.erasedAt !== null) throw new UserAuthorizationDenied();
}

/** Preserve a fixed user/client/authority subject; disconnect is terminal and does not rewrite content. @internal */
export async function applyUserConnectionCommand(tx: DatabaseTransaction, input: UserConnectionCommand, admission: SQL<boolean | null>) {
	const command = connectionSchema.parse(input), requestDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return tx.transaction(async work => {
		const authorize = async () => admit((await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted);
		await authorize(); await lockUser(work, command.authUserId); await authorize();
		if (command.operation === "connect") await work.insert(connectedUserConnection).values({ id: command.connectionId, authUserId: command.authUserId,
			clientId: command.clientId, subjectId: command.subjectId }).onConflictDoNothing({ target: connectedUserConnection.id });
		const [head] = await work.select().from(connectedUserConnection).where(and(eq(connectedUserConnection.id, command.connectionId), eq(connectedUserConnection.authUserId, command.authUserId))).for("update");
		if (!head || (command.operation === "connect" && (head.clientId !== command.clientId || head.subjectId !== command.subjectId))) throw new UserAuthorizationConflict();
		await authorize();
		const [prior] = await work.select().from(connectedUserConnectionEvent).where(and(eq(connectedUserConnectionEvent.connectionId, head.id), eq(connectedUserConnectionEvent.operationId, command.operationId))).limit(1);
		if (prior) {
			if (prior.requestDigest !== requestDigest) throw new UserAuthorizationConflict();
			return { connectionId: head.id, operationId: prior.operationId, version: prior.version, state: prior.stateAfter };
		}
		if (head.version !== command.expectedVersion || head.state === "disconnected" || (command.operation === "connect") !== (head.state === "draft")) throw new UserAuthorizationConflict();
		const nextVersion = head.version + 1;
		if (!Number.isSafeInteger(nextVersion)) throw new UserAuthorizationUnavailable();
		const state = command.operation === "connect" ? "active" as const : "disconnected" as const;
		await work.insert(connectedUserConnectionEvent).values({ connectionId: head.id, version: nextVersion, operationId: command.operationId,
			requestDigest, operation: command.operation, stateAfter: state, operatorAuthUserId: command.authUserId });
		const result = (await work.execute<{ admitted: boolean | null; changed: string | null }>(sql`
			with admission as materialized(select (${admission}) as admitted),changed as (
			 update public.connected_user_connection set version=${nextVersion},state=${state}
			 where id=${head.id}::uuid and version=${head.version} and(select admitted from admission) is true returning id
			) select(select admitted from admission) as admitted,(select id from changed) as changed`)).rows[0];
		admit(result?.admitted); if (!result?.changed) throw new UserAuthorizationConflict();
		return { connectionId: head.id, operationId: command.operationId, version: nextVersion, state };
	});
}

/**
 * Persist explicit user consent under current credential, connection, client and representation admission.
 * @internal
 * @remarks The owner validates user-approved intent and target disclosure first.
 * This writer grants no resource rights and never reads a mutable default. Receipts
 * and sealed references bind the captured subject/resources across tabs and retries.
 */
export async function applyUserConsentCommand(tx: DatabaseTransaction, input: UserConsentCommand, admission: SQL<boolean | null>) {
	const command = consentSchema.parse(input);
	if (command.operation !== "revoke") {
		command.terms.capabilities.sort((a, b) => appCapabilityKey(a) < appCapabilityKey(b) ? -1 : appCapabilityKey(a) > appCapabilityKey(b) ? 1 : 0);
		command.terms.representations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
		if (command.terms.resources.kind === "selected") command.terms.resources.values.sort((a, b) => resourceKey(a) < resourceKey(b) ? -1 : resourceKey(a) > resourceKey(b) ? 1 : 0);
	}
	const requestDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return tx.transaction(async work => {
		const authorize = async () => admit((await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted);
		await authorize(); await lockUser(work, command.authUserId); await authorize();
		const [connection] = await work.select().from(connectedUserConnection).where(and(eq(connectedUserConnection.id, command.connectionId), eq(connectedUserConnection.authUserId, command.authUserId))).for("share");
		if (!connection || (connection.state !== "active" && command.operation !== "revoke")) throw new UserAuthorizationDenied();
		if (command.operation === "grant") await work.insert(connectedUserConsent).values({ id: command.consentId, connectionId: connection.id, clientId: connection.clientId }).onConflictDoNothing({ target: connectedUserConsent.id });
		const [head] = await work.select().from(connectedUserConsent).where(and(eq(connectedUserConsent.id, command.consentId), eq(connectedUserConsent.connectionId, connection.id))).for("update");
		if (!head) throw new UserAuthorizationConflict();
		await authorize();
		const [prior] = await work.select().from(connectedUserConsentEvent).where(and(eq(connectedUserConsentEvent.consentId, head.id), eq(connectedUserConsentEvent.operationId, command.operationId))).limit(1);
		if (prior) {
			if (prior.requestDigest !== requestDigest) throw new UserAuthorizationConflict();
			const termsRevision = prior.operation === "revoke" ? prior.retainedTermsRevision : prior.version;
			if (termsRevision === null) throw new UserAuthorizationUnavailable();
			return { consentId: head.id, operationId: prior.operationId, version: prior.version, state: prior.stateAfter,
				termsRevision };
		}
		if (head.version !== command.expectedVersion || head.state === "revoked" || (command.operation === "grant") !== (head.state === "draft")) throw new UserAuthorizationConflict();
		const nextVersion = head.version + 1;
		if (!Number.isSafeInteger(nextVersion)) throw new UserAuthorizationUnavailable();
		const state = command.operation === "revoke" ? "revoked" as const : "active" as const;
		const termsRevision = command.operation === "revoke" ? head.termsRevision : nextVersion;
		if (termsRevision === null) throw new UserAuthorizationUnavailable();
		await work.insert(connectedUserConsentEvent).values({ consentId: head.id, version: nextVersion, operationId: command.operationId,
			requestDigest, operation: command.operation, stateAfter: state, retainedTermsRevision: command.operation === "revoke" ? head.termsRevision : null,
			operatorAuthUserId: command.authUserId });
		if (command.operation !== "revoke") {
			const { capabilities, resources, representations, ...terms } = command.terms;
			const selectedResources = resources.kind === "selected" ? resources.values : [];
			await work.insert(connectedUserConsentRevision).values({ consentId: head.id, revision: nextVersion, clientId: head.clientId, ...terms,
				resourceSelection: resources.kind, capabilityCount: capabilities.length, capabilityDigest: appCapabilityDigest(capabilities),
				resourceCount: selectedResources.length, resourceDigest: digest(selectedResources.map(resourceKey)),
				representationCount: representations.length, representationDigest: digest(representations.map(value => `${value.id}:${value.revision}`)) });
			if (capabilities.length) await work.insert(connectedUserConsentCapability).values(capabilities.map(value => ({ consentId: head.id, revision: nextVersion, family: value.family, capability: value.key })));
			if (selectedResources.length) await work.insert(connectedUserConsentResource).values(selectedResources.map(value => ({ consentId: head.id, revision: nextVersion, ...value })));
			if (representations.length) await work.insert(connectedUserConsentRepresentation).values(representations.map(value => ({ consentId: head.id, revision: nextVersion, grantId: value.id, termsRevision: value.revision })));
			await work.update(connectedUserConsentRevision).set({ sealed: true }).where(and(eq(connectedUserConsentRevision.consentId, head.id), eq(connectedUserConsentRevision.revision, nextVersion)));
		}
		const result = (await work.execute<{ admitted: boolean | null; changed: string | null }>(sql`
			with admission as materialized(select (${admission}) as admitted),changed as (
			 update public.connected_user_consent set version=${nextVersion},state=${state},terms_revision=${termsRevision}
			 where id=${head.id}::uuid and version=${head.version} and(select admitted from admission) is true returning id
			) select(select admitted from admission) as admitted,(select id from changed) as changed`)).rows[0];
		admit(result?.admitted); if (!result?.changed) throw new UserAuthorizationConflict();
		return { consentId: head.id, operationId: command.operationId, version: nextVersion, state, termsRevision };
	});
}

/** Read a complete captured consent; current user/client/connection/representation and resource checks remain mandatory. @internal */
export async function readUserConsentTerms(tx: DatabaseTransaction, input: { consentId: string; revision: number }) {
	const request = z.strictObject({ consentId: id, revision: version.min(1) }).parse(input);
	const [terms] = await tx.select().from(connectedUserConsentRevision).where(and(eq(connectedUserConsentRevision.consentId, request.consentId),
		eq(connectedUserConsentRevision.revision, request.revision), eq(connectedUserConsentRevision.sealed, true))).limit(1);
	if (!terms) return null;
	const capabilities = await tx.select({ family: connectedUserConsentCapability.family, capability: connectedUserConsentCapability.capability }).from(connectedUserConsentCapability)
		.where(and(eq(connectedUserConsentCapability.consentId, request.consentId), eq(connectedUserConsentCapability.revision, request.revision)))
		.orderBy(sql`${connectedUserConsentCapability.family} collate "C"`, sql`${connectedUserConsentCapability.capability} collate "C"`).limit(MaximumAppCapabilities + 1);
	const resources = await tx.select({ scopeId: connectedUserConsentResource.scopeId, path: connectedUserConsentResource.path }).from(connectedUserConsentResource)
		.where(and(eq(connectedUserConsentResource.consentId, request.consentId), eq(connectedUserConsentResource.revision, request.revision))).limit(65);
	const representations = await tx.select({ id: connectedUserConsentRepresentation.grantId, revision: connectedUserConsentRepresentation.termsRevision }).from(connectedUserConsentRepresentation)
		.where(and(eq(connectedUserConsentRepresentation.consentId, request.consentId), eq(connectedUserConsentRepresentation.revision, request.revision))).orderBy(connectedUserConsentRepresentation.grantId).limit(9);
	if (resources.length > 64 || resources.length !== terms.resourceCount || digest(resources.map(resourceKey)) !== terms.resourceDigest ||
		representations.length > 8 || representations.length !== terms.representationCount || digest(representations.map(value => `${value.id}:${value.revision}`)) !== terms.representationDigest) throw new UserAuthorizationUnavailable();
	if (!z.enum(["all-scopes", "selected"]).safeParse(terms.resourceSelection).success ||
		(terms.resourceSelection === "all-scopes" ? resources.length !== 0 : resources.length === 0) || resources.some(value => !resource.safeParse(value).success)) throw new UserAuthorizationUnavailable();
	return { ...terms, capabilities: decodeAppCapabilities(capabilities, terms.capabilityCount, terms.capabilityDigest),
		resources: [...resources].sort((a, b) => resourceKey(a) < resourceKey(b) ? -1 : resourceKey(a) > resourceKey(b) ? 1 : 0), representations };
}

/**
 * Drain one bounded private authorization batch after credential/context cleanup and account erasure.
 * @internal
 * @remarks Detaching an erased consent head breaks only its selected-revision
 * cycle. All history remains owner-bound until child-first deletion completes.
 * This does not delete public Entities, App declarations or installation grants.
 */
export async function eraseUserAuthorizationBatch(tx: DatabaseTransaction, authUserId: string): Promise<{ deleted: number; empty: boolean }> {
	authUserId = id.parse(authUserId);
	const [user] = await tx.select({ erasedAt: users.erasedAt }).from(users).where(eq(users.id, authUserId)).for("update");
	if (!user?.erasedAt) throw new UserAuthorizationDenied();
	const [connection] = await tx.select().from(connectedUserConnection).where(eq(connectedUserConnection.authUserId, authUserId))
		.orderBy(connectedUserConnection.id).limit(1).for("update");
	if (!connection) return { deleted: 0, empty: true };
	const [consent] = await tx.select().from(connectedUserConsent).where(eq(connectedUserConsent.connectionId, connection.id))
		.orderBy(connectedUserConsent.id).limit(1).for("update");
	if (consent) {
		if (consent.state !== "erasing") await tx.update(connectedUserConsent).set({ state: "erasing", termsRevision: null }).where(eq(connectedUserConsent.id, consent.id));
		for (const table of [connectedUserConsentCapability, connectedUserConsentResource, connectedUserConsentRepresentation]) {
			const deleted = (await tx.execute<{ count: number }>(sql`with batch as materialized(
			 select ctid from ${table} where ${table.consentId}=${consent.id}::uuid limit 500 for update skip locked),deleted as (
			 delete from ${table} where ctid in(select ctid from batch) returning 1) select count(*)::integer as count from deleted`)).rows[0]?.count;
			if (deleted === undefined) throw new UserAuthorizationUnavailable();
			if (deleted) return { deleted, empty: false };
			const remaining = (await tx.execute<{ present: boolean }>(sql`select exists(select 1 from ${table} where ${table.consentId}=${consent.id}::uuid) as present`)).rows[0]?.present;
			if (remaining === undefined) throw new UserAuthorizationUnavailable();
			if (remaining) return { deleted: 0, empty: false };
		}
		const revokedEvents = await tx.delete(connectedUserConsentEvent).where(and(eq(connectedUserConsentEvent.consentId, consent.id), eq(connectedUserConsentEvent.operation, "revoke")))
			.returning({ version: connectedUserConsentEvent.version });
		if (revokedEvents.length) return { deleted: revokedEvents.length, empty: false };
		for (const table of [connectedUserConsentRevision, connectedUserConsentEvent]) {
			const deleted = (await tx.execute<{ count: number }>(sql`with batch as materialized(
			 select ctid from ${table} where ${table.consentId}=${consent.id}::uuid limit 500 for update skip locked),deleted as (
			 delete from ${table} where ctid in(select ctid from batch) returning 1) select count(*)::integer as count from deleted`)).rows[0]?.count;
			if (deleted === undefined) throw new UserAuthorizationUnavailable();
			if (deleted) return { deleted, empty: false };
			const remaining = (await tx.execute<{ present: boolean }>(sql`select exists(select 1 from ${table} where ${table.consentId}=${consent.id}::uuid) as present`)).rows[0]?.present;
			if (remaining === undefined) throw new UserAuthorizationUnavailable();
			if (remaining) return { deleted: 0, empty: false };
		}
		await tx.delete(connectedUserConsent).where(eq(connectedUserConsent.id, consent.id));
		return { deleted: 1, empty: false };
	}
	const events = await tx.delete(connectedUserConnectionEvent).where(eq(connectedUserConnectionEvent.connectionId, connection.id)).returning({ version: connectedUserConnectionEvent.version });
	if (events.length) return { deleted: events.length, empty: false };
	await tx.delete(connectedUserConnection).where(eq(connectedUserConnection.id, connection.id));
	return { deleted: 1, empty: false };
}
