import { AsyncLocalStorage } from "node:async_hooks";
import type { OAuthOptions } from "@better-auth/oauth-provider";
import { APIError } from "better-auth/api";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { withDatabaseTransactionContext, type DatabaseTransaction } from "../database";
import { oauthGrantContext, oauthAccessContext, oauthRefreshContext } from "@rezics/schema/postgres/integrations/oauth-grant-context";
import { oauthAccessTokens, oauthRefreshTokens } from "@rezics/schema/postgres/identity/auth-oauth.generated";
import { users } from "@rezics/schema/postgres/identity/auth";
import { runAccessTransaction, rethrowAccessFailure, requireAccessAdmission } from "../authorization/transaction";
import { AccessChanged, AccessDenied, AccessUnavailable } from "../authorization/http-errors";
import { withFrozenCimdClients } from "./cimd-admission";
import { readOAuthClientPolicy } from "./oauth-client-policy";
import { readOAuthClientSecretPolicy } from "./oauth-client-secrets";
import { readOAuthRefreshTokenContext } from "./oauth-token-context";
import { SupportedOAuthScopes } from "@rezics/schema/contracts/native/oauth";
import { createUserOAuthGrantContext, createInstallationOAuthGrantContext, readOAuthGrantContext,
	invalidateOAuthAuthorizationCode, invalidateOAuthRefreshFamily, lockOAuthRefreshFamily,
	selectOAuthIssuanceContext, OAuthGrantContextDenied, OAuthGrantContextUnavailable } from "./oauth-grant-context";

type RefreshAdmission = Awaited<ReturnType<typeof readOAuthRefreshTokenContext>>;
const requests = new AsyncLocalStorage<{ tx: DatabaseTransaction; clientIds: ReadonlySet<string>; refresh?: RefreshAdmission }>();

function request(clientId: string) {
	const state = requests.getStore();
	if (!state || !state.clientIds.has(clientId)) throw new OAuthGrantContextUnavailable();
	return state;
}
async function callback<T>(work: () => Promise<T>): Promise<T> {
	try { return await work(); }
	catch (error) {
		try { rethrowAccessFailure(error); }
		catch (translated) {
			if (translated instanceof AccessDenied) throw new APIError("BAD_REQUEST", { error: "invalid_grant", error_description: "The native grant is no longer available" });
			if (translated instanceof AccessUnavailable || translated instanceof AccessChanged)
				throw new APIError("SERVICE_UNAVAILABLE", { error: "temporarily_unavailable", error_description: "Native grant admission is unavailable" });
			throw translated;
		}
	}
}

async function requireCurrentClient(tx: DatabaseTransaction, clientId: string) {
	const client = await readOAuthClientPolicy(tx, { clientId });
	await requireAccessAdmission(tx, client.admission);
	if (client.authenticationMethod === "client_secret_basic" || client.authenticationMethod === "client_secret_post")
		await requireAccessAdmission(tx, (await readOAuthClientSecretPolicy(tx, client.id)).admission);
	return client;
}

/**
 * Mandatory native callbacks for the pinned provider's grant lifecycle patch.
 * @internal
 * @remarks The HTTP adapter must use runOAuthProtocolTransaction, prepare CIMD
 * discovery first, bind its consent choice to signed authorization state and set
 * refreshTokenReuseInterval to zero. These callbacks grant no resource access.
 */
export const nativeOAuthGrantLifecycle: NonNullable<OAuthOptions["grantLifecycle"]> = {
	isTokenActive: async info => {
		try {
			return await callback(async () => {
				if (!info.clientId) return false;
				const { tx } = request(info.clientId);
				const table = info.kind === "access_token" ? oauthAccessTokens : oauthRefreshTokens;
				const link = info.kind === "access_token" ? oauthAccessContext : oauthRefreshContext;
				const [pointer] = await tx.select({ contextId: link.contextId }).from(table)
					.innerJoin(link, eq(link.tokenId, table.id)).where(and(eq(table.id, info.tokenId), eq(table.clientId, info.clientId))).limit(1);
				if (!pointer) return false;
				const grant = await readOAuthGrantContext(tx, pointer.contextId);
				const [token] = await tx.select({ id: table.id }).from(table).where(and(eq(table.id, info.tokenId),
					sql`${table.revoked} is null and ${table.expiresAt}>clock_timestamp()`)).for("share");
				if (!token) return false;
				await requireAccessAdmission(tx, grant.admission);
				return true;
			});
		} catch (error) {
			if (error instanceof APIError && error.body?.error === "invalid_grant") return false;
			throw error;
		}
	},
	beforeAuthorizationCode: info => callback(async () => {
		const value = info.verificationValue;
		const clientId = value.query.client_id;
		if (!clientId || !value.referenceId || value.query.code_challenge_method !== "S256" || !value.query.code_challenge)
			throw new OAuthGrantContextDenied();
		const { tx } = request(clientId);
		await createUserOAuthGrantContext(tx, { clientId, principalId: value.userId, consentId: value.referenceId,
			authorizationCodeId: info.authorizationCodeId,
			scopes: z.array(z.enum(SupportedOAuthScopes)).parse(value.query.scope?.split(" ") ?? []), audiences: value.resource ?? [] });
	}),
	beforeRefresh: info => callback(async () => {
		const state = request(info.client.clientId);
		await requireCurrentClient(state.tx, info.client.clientId);
		const admitted = await readOAuthRefreshTokenContext(state.tx, { clientId: info.client.clientId, token: info.token });
		if (admitted.token.id !== info.refreshToken.id) throw new OAuthGrantContextDenied();
		if (admitted.replayed) {
			await invalidateOAuthRefreshFamily(state.tx, { clientId: admitted.grant.context.clientId, principalId: admitted.grant.context.principalId });
			throw new OAuthGrantContextDenied();
		}
		state.refresh = admitted;
	}),
	beforeIssue: info => callback(async () => {
		const { params } = info;
		const state = request(params.client.clientId);
		const client = await requireCurrentClient(state.tx, params.client.clientId);
		let context: typeof oauthGrantContext.$inferSelect;
		if (params.grantType === "authorization_code") {
			if (!params.authorizationCodeId || !params.user || !params.referenceId) throw new OAuthGrantContextDenied();
			const [captured] = await state.tx.select().from(oauthGrantContext).where(and(
				eq(oauthGrantContext.authorizationCodeId, params.authorizationCodeId), eq(oauthGrantContext.clientId, client.id))).limit(1);
			if (!captured || captured.kind !== "user" || captured.principalId !== params.user.id || captured.consentId !== params.referenceId)
				throw new OAuthGrantContextDenied();
			context = (await readOAuthGrantContext(state.tx, captured.id)).context;
		} else if (params.grantType === "refresh_token") {
			if (!state.refresh || state.refresh.token.id !== params.refreshToken?.id || state.refresh.replayed) throw new OAuthGrantContextDenied();
			context = state.refresh.grant.context;
			if (context.clientId !== client.id || context.principalId !== params.user?.id || context.consentId !== params.referenceId ||
				context.authorizationCodeId !== params.authorizationCodeId) throw new OAuthGrantContextDenied();
		} else if (params.grantType === "client_credentials") {
			if (params.user || params.referenceId || params.refreshToken || params.authorizationCodeId) throw new OAuthGrantContextDenied();
			context = await createInstallationOAuthGrantContext(state.tx, { clientId: params.client.clientId,
				scopes: z.array(z.enum(SupportedOAuthScopes)).parse(info.scopes), audiences: info.resources ?? [] });
		} else throw new OAuthGrantContextDenied();
		if (info.scopes.some(scope => !context.scopes.includes(scope)) || !info.resources?.length ||
			info.resources.some(resource => !context.audiences.includes(resource)) ||
			info.refreshResources?.some(resource => !context.audiences.includes(resource))) throw new OAuthGrantContextDenied();
		await selectOAuthIssuanceContext(state.tx, context.id);
		return { expiresAtSeconds: Math.floor(context.validUntil.getTime() / 1000) };
	}),
	invalidateRefreshFamily: info => callback(async () => {
		const { tx } = request(info.clientId);
		const client = await requireCurrentClient(tx, info.clientId);
		await tx.select({ id: users.id }).from(users).where(eq(users.id, info.userId)).for("share");
		await invalidateOAuthRefreshFamily(tx, { clientId: client.id, principalId: info.userId });
	}),
	revokeAuthorizationCode: info => callback(async () => {
		const { tx } = request(info.clientId);
		const client = await requireCurrentClient(tx, info.clientId);
		await invalidateOAuthAuthorizationCode(tx, info.authorizationCodeId, client.id);
	}),
	revokeRefreshToken: info => callback(async () => {
		const { tx } = request(info.clientId);
		const client = await requireCurrentClient(tx, info.clientId);
		const [pointer] = await tx.select({ context: oauthGrantContext }).from(oauthRefreshTokens)
			.innerJoin(oauthRefreshContext, eq(oauthRefreshContext.tokenId, oauthRefreshTokens.id))
			.innerJoin(oauthGrantContext, eq(oauthGrantContext.id, oauthRefreshContext.contextId))
			.where(and(eq(oauthRefreshTokens.id, info.refreshToken.id), eq(oauthRefreshTokens.clientId, info.clientId), eq(oauthGrantContext.clientId, client.id))).limit(1);
		if (!pointer) return;
		await tx.select({ id: users.id }).from(users).where(eq(users.id, pointer.context.principalId)).for("share");
		await lockOAuthRefreshFamily(tx, { clientId: client.id, principalId: pointer.context.principalId });
		await tx.execute(sql`update public.oauth_grant_context set revoked_at=clock_timestamp() where id=${pointer.context.id}::uuid and revoked_at is null`);
	}),
};

class RollbackProtocolResponse extends Error {
	constructor(readonly response: Response) { super("OAuth protocol response requires rollback"); }
}

/**
 * Keep provider writes, native context links and replay invalidation atomic.
 * @internal
 * @remarks A protocol 4xx commits intentional replay invalidation; 5xx rolls back
 * all provisional changes. A thrown exception also rolls back. work must create a
 * fresh Request clone per invocation because retryable database aborts rerun it.
 * Prepare network discovery before entering this scope; at most four clients are
 * retained. Identity/consent/client values remain private and never enter logs.
 */
export async function runOAuthProtocolTransaction(clientIds: readonly string[], work: () => Promise<Response>): Promise<Response> {
	try {
		return await runAccessTransaction(tx => withDatabaseTransactionContext(tx, () =>
			withFrozenCimdClients(tx, clientIds, () => requests.run({ tx, clientIds: new Set(clientIds) }, async () => {
				const response = await work();
				if (response.status >= 500) throw new RollbackProtocolResponse(response);
				return response;
			}))));
	} catch (error) {
		if (error instanceof RollbackProtocolResponse) return error.response;
		throw error;
	}
}
