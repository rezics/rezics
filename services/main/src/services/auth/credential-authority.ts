import { createHash, timingSafeEqual } from "node:crypto";
import { defaultKeyHasher } from "@better-auth/api-key";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { RequestedAuthoritySelection } from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import { apiKeyAuthority, apikeys, sessions, users } from "../database/schema/auth";
import { RequestedAuthoritySelectionSchema } from "../authorization/authority-context";
import { ApiPermissionValues, fromApiKeyPermissions, type ApiPermission } from "./api-permissions";
import { CredentialControlFreshAgeSeconds } from "./credential-policy";

const uuid = z.uuid().toLowerCase();
const authoritySchema = z.union([z.strictObject({ mode: z.literal("operator") }), RequestedAuthoritySelectionSchema]);
const metadataSchema = z.strictObject({ version: z.literal(1), authority: authoritySchema });
/** First-party credential authority is operator-wide or an explicit context limit. @internal */
export type FirstPartyCredentialAuthority = z.infer<typeof authoritySchema>;
/** Private proof produced after authenticating the secret; IDs alone are not credentials. @internal */
export type FirstPartyCredentialProof =
	| { kind: "session"; id: string; principalId: string; tokenDigest: string }
	| { kind: "api-key"; id: string; principalId: string; tokenDigest: string };
/** Credential no longer authenticates its original principal/context or entry scope. @internal */
export class CredentialAuthorityDenied extends Error {
	constructor() { super("Current credential authority is required"); }
}
/** Required credential policy cannot be interpreted or read completely. @internal */
export class CredentialAuthorityUnavailable extends Error {
	constructor() { super("Current credential policy is unavailable"); }
}
const freshAgeMilliseconds = CredentialControlFreshAgeSeconds * 1000;

/** Capture the authenticated session's secret identity without retaining its raw token. @internal */
export function captureSessionCredentialProof(session: { id: string; userId: string; token: string }): FirstPartyCredentialProof {
	return { kind: "session", id: uuid.parse(session.id), principalId: uuid.parse(session.userId),
		tokenDigest: createHash("sha256").update(session.token).digest("hex") };
}
/** Use the pinned provider's hasher for a secret already accepted by verification. @internal */
export async function captureApiKeyCredentialProof(id: string, principalId: string, rawKey: string): Promise<FirstPartyCredentialProof> {
	return { kind: "api-key", id: uuid.parse(id), principalId: uuid.parse(principalId), tokenDigest: await defaultKeyHasher(rawKey) };
}
/** Server-owned metadata for new personal keys; never merge unvalidated authority defaults. @internal */
export function firstPartyAuthorityMetadata(authority: FirstPartyCredentialAuthority) {
	return { rezicsAuthority: metadataSchema.parse({ version: 1, authority }) };
}
function readAuthorityMetadata(value: string | null): FirstPartyCredentialAuthority {
	if (value === null || Buffer.byteLength(value, "utf8") > 8192) throw new CredentialAuthorityUnavailable();
	try {
		const parsed: unknown = JSON.parse(value);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Object.hasOwn(parsed, "rezicsAuthority") || !("rezicsAuthority" in parsed))
			throw new CredentialAuthorityUnavailable();
		return metadataSchema.parse(parsed.rezicsAuthority).authority;
	} catch { throw new CredentialAuthorityUnavailable(); }
}
function matchesDigest(actual: string, expected: string) {
	const a = Buffer.from(actual, "utf8"), b = Buffer.from(expected, "utf8");
	return a.length === b.length && timingSafeEqual(a, b);
}
/** Check only a credential's context ceiling, never the actor's ability to represent an Entity. @internal */
export function credentialAllowsSelection(authority: FirstPartyCredentialAuthority, input: RequestedAuthoritySelection) {
	const limit = authoritySchema.parse(authority), selection = RequestedAuthoritySelectionSchema.parse(input);
	if (limit.mode === "operator") return true;
	if (limit.mode !== selection.mode) return false;
	if (limit.mode === "direct") return true;
	return selection.mode === "represented" && selection.entityId === limit.entityId && selection.representations.every(ref =>
		limit.representations.some(approved => approved.id === ref.id && approved.revision === ref.revision));
}

/**
 * Revalidate a verified first-party credential under live configuration fences.
 * @internal
 * @remarks Secret authentication happens before capture. This reader rechecks the
 * exact secret digest so a same-ID rotation cannot upgrade an earlier proof. Key
 * configuration fences are separate from provider counters. Sessions retain their
 * row fence. Callers separately evaluate current subject, representation, resource
 * policy and quota; a returned credential never proves domain access.
 */
export async function readFirstPartyCredentialAuthority(
	tx: DatabaseTransaction,
	input: { proof: FirstPartyCredentialProof; selection: RequestedAuthoritySelection; apiPermission: ApiPermission | null;
		requireFreshSession: boolean; requireVerifiedEmail: boolean },
) {
	const proof = z.strictObject({ kind: z.enum(["session", "api-key"]), id: uuid, principalId: uuid,
		tokenDigest: z.string().min(1).max(256) }).parse(input.proof);
	const selection = RequestedAuthoritySelectionSchema.parse(input.selection);
	if (input.apiPermission !== null) z.enum(ApiPermissionValues).parse(input.apiPermission);
	const isolation = (await tx.execute<{ isolation: string }>(sql`select current_setting('transaction_isolation') as isolation`)).rows[0]?.isolation;
	if (isolation !== "read committed") throw new CredentialAuthorityUnavailable();
	const [principal] = await tx.select({ kind: users.principalKind, erasedAt: users.erasedAt, verified: users.emailVerified })
		.from(users).where(eq(users.id, proof.principalId)).for("share");
	if (!principal || principal.kind !== "human" || principal.erasedAt !== null || (input.requireVerifiedEmail && !principal.verified)) throw new CredentialAuthorityDenied();
	let expiresAt: Date | null, freshUntil: number | null = null, createdAt: Date;
	let authority: FirstPartyCredentialAuthority;
	let apiPermissions: readonly ApiPermission[];
	let version: number | null = null;
	if (proof.kind === "session") {
		const [session] = await tx.select().from(sessions).where(eq(sessions.id, proof.id)).for("share");
		if (!session || session.userId !== proof.principalId || !matchesDigest(createHash("sha256").update(session.token).digest("hex"), proof.tokenDigest)) throw new CredentialAuthorityDenied();
		expiresAt = session.expiresAt; createdAt = session.createdAt;
		freshUntil = session.createdAt.getTime() + freshAgeMilliseconds;
		authority = { mode: "operator" };
		apiPermissions = ApiPermissionValues;
	} else {
		if (input.apiPermission === null || input.requireFreshSession) throw new CredentialAuthorityDenied();
		const [fence] = await tx.select().from(apiKeyAuthority).where(eq(apiKeyAuthority.id, proof.id)).for("share");
		if (!fence || fence.userId !== proof.principalId || fence.revokedAt !== null) throw new CredentialAuthorityDenied();
		const [key] = await tx.select().from(apikeys).where(eq(apikeys.id, proof.id)).limit(1);
		if (!key || key.referenceId !== proof.principalId || key.configId !== "default" || key.enabled !== true || !matchesDigest(key.key, proof.tokenDigest)) throw new CredentialAuthorityDenied();
		expiresAt = key.expiresAt; createdAt = key.createdAt; version = fence.version;
		authority = readAuthorityMetadata(key.metadata);
		if (key.permissions === null || Buffer.byteLength(key.permissions, "utf8") > 8192) throw new CredentialAuthorityUnavailable();
		try {
			const parsed = z.record(z.string().max(64), z.array(z.string().max(64)).max(ApiPermissionValues.length)).parse(JSON.parse(key.permissions));
			if (Object.keys(parsed).length > ApiPermissionValues.length) throw new CredentialAuthorityUnavailable();
			apiPermissions = fromApiKeyPermissions(parsed);
		} catch { throw new CredentialAuthorityUnavailable(); }
		if (!apiPermissions.includes(input.apiPermission)) throw new CredentialAuthorityDenied();
	}
	const value = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]?.now;
	const now = new Date(value ?? "invalid").getTime();
	if (!Number.isFinite(now) || !Number.isFinite(createdAt.getTime()) || (expiresAt !== null && !Number.isFinite(expiresAt.getTime())) || (freshUntil !== null && !Number.isFinite(freshUntil))) throw new CredentialAuthorityUnavailable();
	if (createdAt.getTime() > now || (expiresAt !== null && expiresAt.getTime() <= now) || !credentialAllowsSelection(authority, selection)) throw new CredentialAuthorityDenied();
	const freshSession = proof.kind === "session" && freshUntil !== null && freshUntil > now;
	if (input.requireFreshSession && !freshSession) throw new CredentialAuthorityDenied();
	return { principalId: proof.principalId, authority, apiPermissions, version, freshSession, freshSessionValidUntil: freshUntil, createdAt, evaluatedAt: new Date(now),
		validUntil: input.requireFreshSession ? Math.min(expiresAt?.getTime() ?? Infinity, freshUntil ?? -Infinity) : expiresAt?.getTime() ?? null,
		audience: `${proof.kind}:${proof.id}` };
}
