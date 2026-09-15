import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { APIError } from "better-auth/api";
import type { DatabaseTransaction } from "../database";
import { oauthClients } from "../database/schema/auth-oauth.generated";
import { oauthClientAuthority } from "../database/schema/oauth-client-authority";
import { ApiPermissionValues } from "./api-permissions";
import { SupportedOAuthScopes } from "./oauth-profile-values";
const scopes = z.array(z.enum(SupportedOAuthScopes)).max(SupportedOAuthScopes.length)
	.refine(values => new Set(values).size === values.length);
const grantTypes = z.array(z.enum(["authorization_code", "refresh_token", "client_credentials"])).max(3)
	.refine(values => new Set(values).size === values.length);
const autonomousScopes = z.array(z.enum(ApiPermissionValues)).max(ApiPermissionValues.length)
	.refine(values => new Set(values).size === values.length);

/** Missing, revoked, disabled or superseded client authority cannot authenticate a native context. @internal */
export class OAuthClientPolicyDenied extends Error {
	constructor() { super("OAuth client authority is unavailable for this operation"); }
}
/** Incomplete or nonconforming stored policy must not be downgraded into an ordinary empty grant. @internal */
export class OAuthClientPolicyUnavailable extends Error {
	constructor() { super("OAuth client policy could not be established"); }
}

/**
 * Retain exact current client configuration and invalidation fences in the caller's transaction.
 * @internal
 * @remarks Authentication, App/client admission, consent or installation and
 * domain permission remain additional requirements. Never expose the returned
 * private root reference or treat this configuration read as proof of a secret.
 */
export async function readOAuthClientPolicy(tx: DatabaseTransaction, input: { clientId: string; credentialEpoch?: number }) {
	const request = z.strictObject({ clientId: z.string().min(1).refine(value => Buffer.byteLength(value, "utf8") <= 2048),
		credentialEpoch: z.number().int().nonnegative().safe().optional() }).parse(input);
	const isolation = (await tx.execute<{ isolation: string }>(sql`select current_setting('transaction_isolation') as isolation`)).rows[0]?.isolation;
	if (isolation !== "read committed") throw new OAuthClientPolicyUnavailable();
	const [fence] = await tx.select().from(oauthClientAuthority).where(eq(oauthClientAuthority.clientId, request.clientId)).for("share");
	if (!fence || fence.revokedAt !== null || (request.credentialEpoch !== undefined && request.credentialEpoch !== fence.credentialEpoch))
		throw new OAuthClientPolicyDenied();
	const [client] = await tx.select({ id: oauthClients.id, clientId: oauthClients.clientId, disabled: oauthClients.disabled,
		discoveryId: oauthClients.clientDiscoveryId, appReference: oauthClients.referenceId, subjectType: oauthClients.subjectType,
		userId: oauthClients.userId, skipConsent: oauthClients.skipConsent, enableEndSession: oauthClients.enableEndSession,
		postLogoutRedirectUris: oauthClients.postLogoutRedirectUris, backchannelLogoutUri: oauthClients.backchannelLogoutUri,
		backchannelLogoutSessionRequired: oauthClients.backchannelLogoutSessionRequired, metadata: oauthClients.metadata,
		requirePKCE: oauthClients.requirePKCE, scopes: oauthClients.scopes, clientCredentialsScopes: oauthClients.clientCredentialsScopes,
		grantTypes: oauthClients.grantTypes, tokenEndpointAuthMethod: oauthClients.tokenEndpointAuthMethod,
		dpopBoundAccessTokens: oauthClients.dpopBoundAccessTokens }).from(oauthClients)
		.where(and(eq(oauthClients.id, fence.id), eq(oauthClients.clientId, request.clientId))).limit(1);
	if (!client || client.disabled === true) throw new OAuthClientPolicyDenied();
	if (client.disabled !== false || client.discoveryId !== fence.discoveryId || client.subjectType !== "pairwise" ||
		client.userId !== null || client.skipConsent !== false || client.enableEndSession !== false || client.requirePKCE !== true ||
		client.postLogoutRedirectUris !== null || client.backchannelLogoutUri !== null || client.backchannelLogoutSessionRequired !== false ||
		client.metadata !== null) throw new OAuthClientPolicyUnavailable();
	const allowedScopes = scopes.safeParse(client.scopes);
	const machineScopes = autonomousScopes.safeParse(client.clientCredentialsScopes ?? []);
	const allowedGrants = grantTypes.safeParse(client.grantTypes);
	const method = z.enum(["none", "client_secret_basic", "client_secret_post", "private_key_jwt"]).safeParse(client.tokenEndpointAuthMethod ?? "client_secret_basic");
	const reference = z.uuid().toLowerCase().nullable().safeParse(client.appReference);
	if (!allowedScopes.success || !machineScopes.success || !allowedGrants.success || !method.success || !reference.success)
		throw new OAuthClientPolicyUnavailable();
	const admission = sql<boolean>`exists(select 1 from public.oauth_client_authority a join public.oauth_client c on c.id=a.id
		where a.id=${fence.id}::uuid and a.client_id=${request.clientId} and c.client_id=a.client_id
		and a.version=${fence.version} and a.credential_epoch=${fence.credentialEpoch} and a.revoked_at is null and c.disabled=false)`;
	return { id: fence.id, clientId: request.clientId, version: fence.version, credentialEpoch: fence.credentialEpoch,
		discoveryId: fence.discoveryId, appReference: reference.data, allowedScopes: allowedScopes.data,
		clientCredentialsScopes: machineScopes.data, grantTypes: allowedGrants.data, authenticationMethod: method.data,
		dpopBoundAccessTokens: client.dpopBoundAccessTokens === true, admission };
}

/** Map only the named native profile violation to a redacted OAuth metadata error. @internal */
export function rethrowOAuthClientProfileError(error: unknown): never {
	let cause = error;
	for (let depth = 0; depth < 8 && cause && typeof cause === "object"; depth++) {
		if ("code" in cause && cause.code === "23514" && "constraint" in cause && cause.constraint === "oauth_client_private_profile")
			throw new APIError("BAD_REQUEST", { error: "invalid_client_metadata", error_description: "Client metadata is outside the supported profile" });
		cause = "cause" in cause ? cause.cause : null;
	}
	throw error;
}
