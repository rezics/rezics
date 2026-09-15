import { createHash } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { oauthClientAuthority } from "../database/schema/oauth-client-authority";
import { oauthClients } from "../database/schema/auth-oauth.generated";
import { oauthClientSecretEvent, oauthClientSecretPolicy } from "../database/schema/oauth-client-secret-policy";

const id = z.uuid().toLowerCase(), version = z.number().int().nonnegative().safe();
const base = { clientId: id, operationId: id, expectedVersion: version, operatorAuthUserId: id, authoritySubjectId: id };
const material = { secretDigest: z.string().regex(/^[A-Za-z0-9_-]{43}$/), validFrom: z.date(), validUntil: z.date() };
const schema = z.discriminatedUnion("operation", [
	z.strictObject({ ...base, ...material, operation: z.literal("issue"), expectedVersion: z.literal(0) }),
	z.strictObject({ ...base, ...material, operation: z.literal("rotate") }),
	z.strictObject({ ...base, operation: z.literal("retire") }),
]).refine(value => value.operation === "retire" || (value.validUntil > value.validFrom && value.validUntil.getTime() - value.validFrom.getTime() <= 365 * 86_400_000));
/** Native lifetime paired atomically with provider-generated, hashed secret material. @internal */
export type OAuthClientSecretCommand = z.infer<typeof schema>;
/** Stable outcome never includes secret plaintext or its digest. @internal */
export interface OAuthClientSecretReceipt { clientId: string; operationId: string; version: number; state: "active" | "retired"; validUntil: Date }
/** Stale secret state or a different replay intent. @internal */
export class OAuthClientSecretConflict extends Error {
	constructor() { super("Client secret control conflicts with current state or its receipt"); }
}
/** Missing, retired or expired material cannot authenticate a client. @internal */
export class OAuthClientSecretDenied extends Error {
	constructor() { super("Current client secret authority is required"); }
}
/** Incomplete secret policy is not permission to ignore its lifetime. @internal */
export class OAuthClientSecretUnavailable extends Error {
	constructor() { super("Client secret policy is unavailable"); }
}
/** Pinned provider-compatible digest of high-entropy unprefixed secret material. @internal */
export function oauthClientSecretDigest(unprefixedSecret: string): string {
	return createHash("sha256").update(unprefixedSecret, "utf8").digest("base64url");
}
function admit(value: boolean | null | undefined) {
	if (value === false) throw new OAuthClientSecretDenied();
	if (value !== true) throw new OAuthClientSecretUnavailable();
}
function receipt(event: typeof oauthClientSecretEvent.$inferSelect): OAuthClientSecretReceipt {
	return { clientId: event.clientId, operationId: event.operationId, version: event.version, state: event.stateAfter, validUntil: event.validUntil };
}

/**
 * Retain secret lifetime after the provider installs new material in the same owner transaction.
 * @internal
 * @remarks The caller owns fresh credential-management admission and the provider
 * write. Original plaintext is returned by that producer once; replay exposes only
 * this receipt. Rotation must use new material, including after retirement. It
 * does not revoke otherwise valid access/refresh grants; client/App epochs do that.
 */
export async function applyOAuthClientSecretCommand(tx: DatabaseTransaction, input: OAuthClientSecretCommand, admission: SQL<boolean | null>): Promise<OAuthClientSecretReceipt> {
	const command = schema.parse(input);
	const requestDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return tx.transaction(async work => {
		const authorize = async () => admit((await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted);
		await authorize();
		const [control] = await work.select().from(oauthClientAuthority).where(eq(oauthClientAuthority.id, command.clientId)).for("update");
		if (!control || (control.revokedAt !== null && command.operation !== "retire")) throw new OAuthClientSecretDenied();
		await authorize();
		if (command.operation === "issue") await work.insert(oauthClientSecretPolicy).values({ clientId: command.clientId }).onConflictDoNothing();
		const [head] = await work.select().from(oauthClientSecretPolicy).where(eq(oauthClientSecretPolicy.clientId, command.clientId)).for("update");
		if (!head) throw new OAuthClientSecretConflict();
		await authorize();
		const [prior] = await work.select().from(oauthClientSecretEvent).where(and(eq(oauthClientSecretEvent.clientId, head.clientId), eq(oauthClientSecretEvent.operationId, command.operationId))).limit(1);
		if (prior) {
			if (prior.requestDigest !== requestDigest) throw new OAuthClientSecretConflict();
			return receipt(prior);
		}
		if (head.version !== command.expectedVersion || (command.operation === "issue") !== (head.state === "draft") ||
			(command.operation === "retire" && head.state !== "active")) throw new OAuthClientSecretConflict();
		const nextVersion = head.version + 1;
		if (!Number.isSafeInteger(nextVersion)) throw new OAuthClientSecretUnavailable();
		const secretDigest = command.operation === "retire" ? head.secretDigest : command.secretDigest;
		const validFrom = command.operation === "retire" ? head.validFrom : command.validFrom;
		const validUntil = command.operation === "retire" ? head.validUntil : command.validUntil;
		if (secretDigest === null || validFrom === null || validUntil === null) throw new OAuthClientSecretUnavailable();
		if (command.operation === "rotate") {
			const [used] = await work.select({ version: oauthClientSecretEvent.version }).from(oauthClientSecretEvent)
				.where(and(eq(oauthClientSecretEvent.clientId, head.clientId), eq(oauthClientSecretEvent.secretDigest, secretDigest),
					sql`${oauthClientSecretEvent.operation} in ('issue','rotate')`)).limit(1);
			if (used) throw new OAuthClientSecretConflict();
		}
		const state = command.operation === "retire" ? "retired" as const : "active" as const;
		const [event] = await work.insert(oauthClientSecretEvent).values({ clientId: head.clientId, version: nextVersion,
			operationId: command.operationId, requestDigest, operation: command.operation, stateAfter: state, secretDigest, validFrom, validUntil,
			operatorAuthUserId: command.operatorAuthUserId, authoritySubjectId: command.authoritySubjectId }).returning();
		if (!event) throw new OAuthClientSecretUnavailable();
		const result = (await work.execute<{ admitted: boolean | null; changed: string | null }>(sql`
			with admission as materialized(select (${admission}) as admitted),changed as (
			 update public.oauth_client_secret_policy set version=${nextVersion},state=${state},secret_digest=${secretDigest},valid_from=${validFrom},valid_until=${validUntil}
			 where client_id=${head.clientId}::uuid and version=${head.version} and(select admitted from admission) is true returning client_id
			) select(select admitted from admission) as admitted,(select client_id from changed) as changed`)).rows[0];
		admit(result?.admitted);
		if (!result?.changed) throw new OAuthClientSecretConflict();
		return receipt(event);
	});
}

/** Check current shared-secret lifetime while retaining the protocol fence; this is not cryptographic possession proof. @internal */
export async function readOAuthClientSecretPolicy(tx: DatabaseTransaction, clientId: string) {
	clientId = id.parse(clientId);
	if ((await tx.execute<{ isolation: string }>(sql`select current_setting('transaction_isolation') as isolation`)).rows[0]?.isolation !== "read committed") throw new OAuthClientSecretUnavailable();
	const [control] = await tx.select().from(oauthClientAuthority).where(eq(oauthClientAuthority.id, clientId)).for("share");
	if (!control || control.revokedAt !== null) throw new OAuthClientSecretDenied();
	const [policy] = await tx.select().from(oauthClientSecretPolicy).where(eq(oauthClientSecretPolicy.clientId, clientId)).limit(1);
	if (!policy || policy.version < 1 || policy.secretDigest === null || policy.validFrom === null || policy.validUntil === null) throw new OAuthClientSecretUnavailable();
	const [client] = await tx.select({ secret: oauthClients.clientSecret, disabled: oauthClients.disabled, method: oauthClients.tokenEndpointAuthMethod,
		discoveryId: oauthClients.clientDiscoveryId }).from(oauthClients).where(eq(oauthClients.id, clientId)).limit(1);
	if (!client || client.disabled !== false || client.discoveryId !== null || !["client_secret_basic", "client_secret_post"].includes(client.method ?? "client_secret_basic")) throw new OAuthClientSecretDenied();
	if (client.secret !== policy.secretDigest) throw new OAuthClientSecretUnavailable();
	const time = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]?.now;
	const now = new Date(time ?? "invalid").getTime();
	if (![now, policy.validFrom.getTime(), policy.validUntil.getTime()].every(Number.isFinite)) throw new OAuthClientSecretUnavailable();
	if (policy.state !== "active" || policy.validFrom.getTime() > now || policy.validUntil.getTime() <= now) throw new OAuthClientSecretDenied();
	const admission = sql<boolean>`public.oauth_client_secret_is_current(${clientId}::uuid) is true and
		exists(select 1 from public.oauth_client_secret_policy where client_id=${clientId}::uuid and version=${policy.version}) and
		exists(select 1 from public.oauth_client_authority where id=${clientId}::uuid and version=${control.version} and revoked_at is null)`;
	return { version: policy.version, validUntil: policy.validUntil, admission };
}
