import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { users } from "../database/schema/auth";
import { identityPreference, identityPreferenceEvent, identityPreferenceRepresentation } from "../database/schema/identity-preference";
import { RequestedAuthoritySelectionSchema } from "./authority-context";

/** One bounded explicit representation context, retained only as a revalidation hint. @internal */
export const IdentityPreferenceRepresentationsSchema = RequestedAuthoritySelectionSchema.options[1].shape.representations.max(8);

const versionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const selectionSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("entity"), entityId: z.uuid().toLowerCase(), representations: IdentityPreferenceRepresentationsSchema }),
	z.strictObject({ kind: z.literal("none") }),
	z.strictObject({ kind: z.literal("inherit-main") }),
]);
const commandSchema = z.strictObject({
	authUserId: z.uuid().toLowerCase(), clientId: z.uuid().toLowerCase().nullable(), expectedVersion: versionSchema,
	operationId: z.uuid().toLowerCase(), operatorAuthUserId: z.uuid().toLowerCase(), authoritySubjectId: z.uuid().toLowerCase(), selection: selectionSchema,
}).refine(command => command.clientId !== null || command.selection.kind !== "inherit-main", "Main identity cannot inherit itself");
/** Revision-bound private selection; the command neither issues nor edits representation authority. @internal */
export type IdentityPreferenceCommand = z.infer<typeof commandSchema>;
/** Stable outcome of one preference command; it is not proof of identity usability. @internal */
export interface IdentityPreferenceReceipt { preferenceId: string; operationId: string; version: number }
/** Requested preference revision or operation identity conflicts with retained state. @internal */
export class IdentityPreferenceConflict extends Error {
	constructor() { super("Identity preference changed or the operation identity was reused"); }
}
/** Current preference management or chosen-identity usability admission denied this command. @internal */
export class IdentityPreferenceDenied extends Error {
	constructor() { super("Current account preference and identity selection admission are required"); }
}
/** An unavailable/erased account or incomplete authority cannot yield a preference selection. @internal */
export class IdentityPreferenceUnavailable extends Error {
	constructor() { super("Identity preference or account authority is unavailable"); }
}
function admit(value: boolean | null | undefined) {
	if (value === false) throw new IdentityPreferenceDenied();
	if (value !== true) throw new IdentityPreferenceUnavailable();
}
function representationDigest(refs: readonly { id: string; revision: number }[]) {
	return createHash("sha256").update(refs.map(ref => `${ref.id}:${ref.revision}`).sort().join("\n")).digest("hex");
}

/**
 * Store an explicit main/client choice in a rollback-safe command with current SQL admission.
 * @internal
 * @remarks The owner promotes the account mutation fence before evaluating current
 * management authority, permitted client and usability for the target account.
 * Selection may be delegated under action-specific policy; audit IDs do not prove
 * it. Admission is rechecked after waits and at the effect. No default change may
 * be interpreted as a grant, consent update or prepared request retargeting.
 */
export async function applyIdentityPreferenceCommand(
	tx: DatabaseTransaction, input: IdentityPreferenceCommand, admission: SQL<boolean | null>,
): Promise<IdentityPreferenceReceipt> {
	const command = commandSchema.parse(input);
	if (command.selection.kind === "entity") command.selection.representations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	const requestDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return tx.transaction(async work => {
		const authorize = async () => admit((await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted);
		await authorize();
		const [account] = await work.select({ erasedAt: users.erasedAt }).from(users)
			.where(eq(users.id, command.authUserId)).for("update");
		if (!account || account.erasedAt !== null) throw new IdentityPreferenceUnavailable();
		await authorize();
		await work.insert(identityPreference).values({ authUserId: command.authUserId, clientId: command.clientId })
			.onConflictDoNothing();
		const [head] = await work.select().from(identityPreference).where(and(
			eq(identityPreference.authUserId, command.authUserId), command.clientId === null
				? isNull(identityPreference.clientId) : eq(identityPreference.clientId, command.clientId),
		)).for("update");
		if (!head) throw new IdentityPreferenceUnavailable();
		await authorize();
		const [prior] = await work.select().from(identityPreferenceEvent).where(and(
			eq(identityPreferenceEvent.preferenceId, head.id), eq(identityPreferenceEvent.operationId, command.operationId),
		)).limit(1);
		if (prior) {
			if (prior.requestDigest !== requestDigest || prior.operatorAuthUserId !== command.operatorAuthUserId || prior.authoritySubjectId !== command.authoritySubjectId)
				throw new IdentityPreferenceConflict();
			return { preferenceId: head.id, operationId: prior.operationId, version: prior.version };
		}
		if (head.version !== command.expectedVersion) throw new IdentityPreferenceConflict();
		const version = head.version + 1;
		const entityId = command.selection.kind === "entity" ? command.selection.entityId : null;
		const representations = command.selection.kind === "entity" ? command.selection.representations : [];
		await work.insert(identityPreferenceEvent).values({ preferenceId: head.id, version,
			operationId: command.operationId, requestDigest, selectionKind: command.selection.kind, entityId,
			representationCount: representations.length, representationDigest: representationDigest(representations),
			operatorAuthUserId: command.operatorAuthUserId, authoritySubjectId: command.authoritySubjectId });
		if (representations.length) await work.insert(identityPreferenceRepresentation).values(representations.map(ref => ({
			preferenceId: head.id, version, grantId: ref.id, termsRevision: ref.revision,
		})));
		const result = await work.execute<{ admitted: boolean | null; changed: string | null }>(sql`
			with admission as materialized(select (${admission}) as admitted),changed as (
				update public.identity_preference set version=${version},selection_kind=${command.selection.kind},entity_id=${entityId}::uuid
				where id=${head.id}::uuid and version=${head.version} and(select admitted from admission) is true returning id
			) select(select admitted from admission) as admitted,(select id from changed) as changed`);
		admit(result.rows[0]?.admitted);
		if (!result.rows[0]?.changed) throw new IdentityPreferenceConflict();
		return { preferenceId: head.id, operationId: command.operationId, version };
	});
}

/**
 * Capture a private convenience choice once, with main/client revisions kept distinct.
 * @internal
 * @remarks The caller admits the client, authorizes target-account disclosure and checks current
 * usability of the returned Entity. Missing client override inherits main; explicit
 * none does not. An unusable selected Entity never falls back to another identity.
 * Pass the captured Entity into prepared work, then revalidate its representation
 * at effects; do not reread preferences to change attribution or consent.
 */
export async function captureIdentityPreference(
	tx: DatabaseTransaction, input: { authUserId: string; clientId: string | null },
): Promise<{ entityId: string | null; representations: { id: string; revision: number }[]; source: "client" | "main" | "none"; mainVersion: number; clientVersion: number }> {
	const request = z.strictObject({ authUserId: z.uuid().toLowerCase(), clientId: z.uuid().toLowerCase().nullable() }).parse(input);
	const isolation = (await tx.execute<{ isolation: string }>(sql`select current_setting('transaction_isolation') as isolation`)).rows[0]?.isolation;
	if (isolation !== "read committed") throw new IdentityPreferenceUnavailable();
	const [account] = await tx.select({ erasedAt: users.erasedAt }).from(users)
		.where(eq(users.id, request.authUserId)).for("share");
	if (!account || account.erasedAt !== null) throw new IdentityPreferenceUnavailable();
	const rows = await tx.select().from(identityPreference).where(and(eq(identityPreference.authUserId, request.authUserId),
		request.clientId === null ? isNull(identityPreference.clientId)
			: sql`(${identityPreference.clientId} is null or ${identityPreference.clientId}=${request.clientId}::uuid)`)).limit(3);
	if (rows.length > 2 || rows.some(row => row.version < 1)) throw new IdentityPreferenceUnavailable();
	const main = rows.find(row => row.clientId === null), client = rows.find(row => row.clientId === request.clientId && row.clientId !== null);
	const mainVersion = main?.version ?? 0, clientVersion = client?.version ?? 0;
	const selected = client && client.selectionKind !== "inherit-main" ? client : main;
	let representations: { id: string; revision: number }[] = [];
	if (selected) {
		const [event] = await tx.select().from(identityPreferenceEvent).where(and(
			eq(identityPreferenceEvent.preferenceId, selected.id), eq(identityPreferenceEvent.version, selected.version))).limit(1);
		representations = await tx.select({ id: identityPreferenceRepresentation.grantId, revision: identityPreferenceRepresentation.termsRevision })
			.from(identityPreferenceRepresentation).where(and(eq(identityPreferenceRepresentation.preferenceId, selected.id),
				eq(identityPreferenceRepresentation.version, selected.version))).orderBy(identityPreferenceRepresentation.grantId).limit(9);
		if (!event || event.entityId !== selected.entityId || event.selectionKind !== selected.selectionKind ||
			representations.length > 8 || event.representationCount !== representations.length ||
			event.representationDigest !== representationDigest(representations)) throw new IdentityPreferenceUnavailable();
		if (selected.selectionKind === "entity") {
			const parsed = IdentityPreferenceRepresentationsSchema.safeParse(representations);
			if (!parsed.success) throw new IdentityPreferenceUnavailable();
			representations = parsed.data;
		} else if (representations.length) throw new IdentityPreferenceUnavailable();
	}
	if (client && client.selectionKind !== "inherit-main")
		return { entityId: client.entityId, representations, source: "client", mainVersion, clientVersion };
	return { entityId: main?.entityId ?? null, representations, source: main?.entityId ? "main" : "none", mainVersion, clientVersion };
}

/** Delete at most 500 private hints/receipts or one empty head after the account erasure frontier. @internal */
export async function eraseIdentityPreferenceBatch(
	tx: DatabaseTransaction, authUserId: string,
): Promise<{ deleted: number; empty: boolean }> {
	authUserId = z.uuid().toLowerCase().parse(authUserId);
	const [account] = await tx.select({ erasedAt: users.erasedAt }).from(users)
		.where(eq(users.id, authUserId)).for("no key update");
	if (!account?.erasedAt) throw new IdentityPreferenceDenied();
	const [head] = await tx.select({ id: identityPreference.id }).from(identityPreference)
		.where(eq(identityPreference.authUserId, authUserId)).orderBy(identityPreference.id)
		.limit(1).for("update", { skipLocked: true });
	if (!head) {
		const [remaining] = await tx.select({ id: identityPreference.id }).from(identityPreference)
			.where(eq(identityPreference.authUserId, authUserId)).limit(1);
		return { deleted: 0, empty: !remaining };
	}
	const hints = await tx.select({ version: identityPreferenceRepresentation.version, grantId: identityPreferenceRepresentation.grantId })
		.from(identityPreferenceRepresentation).where(eq(identityPreferenceRepresentation.preferenceId, head.id))
		.orderBy(identityPreferenceRepresentation.version, identityPreferenceRepresentation.grantId).limit(500);
	if (hints.length) {
		const deleted = await tx.delete(identityPreferenceRepresentation).where(and(eq(identityPreferenceRepresentation.preferenceId, head.id),
			or(...hints.map(hint => and(eq(identityPreferenceRepresentation.version, hint.version), eq(identityPreferenceRepresentation.grantId, hint.grantId))))))
			.returning({ grantId: identityPreferenceRepresentation.grantId });
		return { deleted: deleted.length, empty: false };
	}
	const events = await tx.select({ version: identityPreferenceEvent.version }).from(identityPreferenceEvent)
		.where(eq(identityPreferenceEvent.preferenceId, head.id)).orderBy(identityPreferenceEvent.version)
		.limit(500).for("update", { skipLocked: true });
	if (events.length) {
		const deleted = await tx.delete(identityPreferenceEvent).where(and(
			eq(identityPreferenceEvent.preferenceId, head.id), inArray(identityPreferenceEvent.version, events.map(event => event.version)),
		)).returning({ version: identityPreferenceEvent.version });
		return { deleted: deleted.length, empty: false };
	}
	const [remaining] = await tx.select({ version: identityPreferenceEvent.version }).from(identityPreferenceEvent)
		.where(eq(identityPreferenceEvent.preferenceId, head.id)).limit(1);
	if (remaining) return { deleted: 0, empty: false };
	const deleted = await tx.delete(identityPreference).where(eq(identityPreference.id, head.id)).returning({ id: identityPreference.id });
	return { deleted: deleted.length, empty: false };
}
