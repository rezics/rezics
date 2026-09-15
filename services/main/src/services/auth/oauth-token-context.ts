import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ResourceUriSchema } from "@better-auth/oauth-provider";
import type { DatabaseTransaction } from "../database";
import { oauthAccessTokens, oauthRefreshTokens } from "../database/schema/auth-oauth.generated";
import { oauthAccessContext, oauthRefreshContext, oauthGrantContext, oauthRefreshFamily } from "../database/schema/oauth-grant-context";
import { users } from "../database/schema/auth";
import { OAuthCredentialPrefixes, SupportedOAuthScopes } from "./oauth-profile-values";
import { ApiPermissionValues, type ApiPermission } from "./api-permissions";
import { oauthProtocolTokenDigest, OAuthGrantContextDenied, OAuthGrantContextUnavailable, readOAuthGrantContext } from "./oauth-grant-context";

function tokenDigest(token: string, prefix: string) {
	if (typeof token !== "string" || token.length > 1024 || !token.startsWith(prefix)) throw new OAuthGrantContextDenied();
	const raw = token.slice(prefix.length);
	if (!/^[A-Za-z0-9_-]{32,256}$/.test(raw)) throw new OAuthGrantContextDenied();
	return oauthProtocolTokenDigest(raw);
}

/**
 * Verify an opaque access token's native identity, audience and current grant dependencies.
 * @internal
 * @remarks Sender-constrained tokens still require their DPoP proof, and every
 * resource operation needs its domain/representation checks and quota. Explicit
 * invalid OAuth credentials must not fall back to an ambient session cookie.
 */
export async function readOAuthAccessTokenContext(tx: DatabaseTransaction, input: { token: string; audience: string; apiPermission?: ApiPermission }) {
	const request = z.strictObject({ token: z.string().max(1024), audience: ResourceUriSchema, apiPermission: z.enum(ApiPermissionValues).optional() }).parse(input);
	const digest = tokenDigest(request.token, OAuthCredentialPrefixes.accessToken);
	const [pointer] = await tx.select({ tokenId: oauthAccessTokens.id, contextId: oauthAccessContext.contextId }).from(oauthAccessTokens)
		.innerJoin(oauthAccessContext, eq(oauthAccessContext.tokenId, oauthAccessTokens.id)).where(eq(oauthAccessTokens.token, digest)).limit(1);
	if (!pointer) throw new OAuthGrantContextDenied();
	const grant = await readOAuthGrantContext(tx, pointer.contextId);
	const [token] = await tx.select().from(oauthAccessTokens).where(and(eq(oauthAccessTokens.id, pointer.tokenId), eq(oauthAccessTokens.token, digest))).for("share");
	if (!token || token.revoked !== null || !token.resources?.includes(request.audience) ||
		(request.apiPermission !== undefined && !token.scopes.includes(request.apiPermission))) throw new OAuthGrantContextDenied();
	const scopes = z.array(z.enum(SupportedOAuthScopes)).max(SupportedOAuthScopes.length).safeParse(token.scopes);
	if (!scopes.success || !Number.isFinite(token.expiresAt.getTime())) throw new OAuthGrantContextUnavailable();
	const admission = sql<boolean>`(${grant.admission}) and exists(select 1 from public.oauth_access_token t
		join public.oauth_access_context c on c.token_id=t.id where t.id=${token.id}::uuid and t.token=${digest}
		and c.context_id=${grant.context.id}::uuid and t.revoked is null and t.expires_at>clock_timestamp()
		and ${request.audience}=ANY(t.resources) ${request.apiPermission ? sql`and ${request.apiPermission}=ANY(t.scopes)` : sql``})`;
	const current = (await tx.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted;
	if (current === false) throw new OAuthGrantContextDenied();
	if (current !== true) throw new OAuthGrantContextUnavailable();
	return { tokenId: token.id, grant, scopes: scopes.data, expiresAt: token.expiresAt, confirmation: token.confirmation, admission };
}

/**
 * Resolve the original native refresh context after protocol client authentication.
 * @internal
 * @remarks Rotated/revoked rows are returned only as replay evidence. The caller
 * must invalidate their authenticated family and reject rather than issuing from
 * them. No refresh path creates a replacement grant from current defaults.
 */
export async function readOAuthRefreshTokenContext(tx: DatabaseTransaction, input: { token: string; clientId: string }) {
	const request = z.strictObject({ token: z.string().max(1024), clientId: z.string().min(1).refine(value => Buffer.byteLength(value, "utf8") <= 2048) }).parse(input);
	const digest = tokenDigest(request.token, OAuthCredentialPrefixes.refreshToken);
	const [pointer] = await tx.select({ tokenId: oauthRefreshTokens.id, contextId: oauthRefreshContext.contextId,
		familyId: oauthGrantContext.refreshFamilyId, principalId: oauthGrantContext.principalId, clientId: oauthGrantContext.clientId }).from(oauthRefreshTokens)
		.innerJoin(oauthRefreshContext, eq(oauthRefreshContext.tokenId, oauthRefreshTokens.id))
		.innerJoin(oauthGrantContext, eq(oauthGrantContext.id, oauthRefreshContext.contextId))
		.where(and(eq(oauthRefreshTokens.token, digest), eq(oauthRefreshTokens.clientId, request.clientId))).limit(1);
	if (!pointer || !pointer.familyId) throw new OAuthGrantContextDenied();
	const [account] = await tx.select({ id: users.id }).from(users).where(eq(users.id, pointer.principalId)).for("share");
	if (!account) throw new OAuthGrantContextDenied();
	const [family] = await tx.select().from(oauthRefreshFamily).where(eq(oauthRefreshFamily.id, pointer.familyId)).for("update");
	if (!family || family.authUserId !== pointer.principalId || family.clientId !== pointer.clientId) throw new OAuthGrantContextDenied();
	const grant = await readOAuthGrantContext(tx, pointer.contextId);
	if (grant.context.kind !== "user" || !grant.context.refreshFamilyId || !grant.user || grant.user.client.protocol.clientId !== request.clientId) throw new OAuthGrantContextDenied();
	const [token] = await tx.select().from(oauthRefreshTokens).where(and(eq(oauthRefreshTokens.id, pointer.tokenId), eq(oauthRefreshTokens.token, digest))).for("update");
	if (!token || token.userId !== grant.context.principalId) throw new OAuthGrantContextDenied();
	const clock = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]?.now;
	const now = new Date(clock ?? "invalid").getTime();
	if (!Number.isFinite(now) || !Number.isFinite(token.expiresAt.getTime())) throw new OAuthGrantContextUnavailable();
	if (token.expiresAt.getTime() <= now) throw new OAuthGrantContextDenied();
	return { token, grant, replayed: token.revoked !== null || token.rotatedAt !== null };
}
