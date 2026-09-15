import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ResourceUriSchema } from "@better-auth/oauth-provider";
import type { DatabaseTransaction } from "../database";
import { oauthGrantContext, oauthRefreshFamily } from "../database/schema/oauth-grant-context";
import { readAppClientAdmission } from "../connected-apps/client-admission";
import { readUserConsentAdmission } from "../connected-apps/user-authority";
import { SupportedOAuthScopes } from "./oauth-profile-values";

const id = z.uuid().toLowerCase();
const envelope = z.strictObject({
	clientId: z.string().min(1).refine(value => Buffer.byteLength(value, "utf8") <= 2048),
	scopes: z.array(z.enum(SupportedOAuthScopes)).max(SupportedOAuthScopes.length).refine(values => new Set(values).size === values.length),
	audiences: z.array(ResourceUriSchema).min(1).max(4).refine(values => new Set(values).size === values.length && Buffer.byteLength(values.join(" "), "utf8") <= 8192),
});
/** Invalidated native context is not repaired by a valid protocol signature or refresh token. @internal */
export class OAuthGrantContextDenied extends Error {
	constructor() { super("OAuth grant context is no longer current"); }
}
/** Missing or incomplete native context cannot become protocol authority. @internal */
export class OAuthGrantContextUnavailable extends Error {
	constructor() { super("OAuth grant context is unavailable"); }
}
/** Pinned provider-compatible digest for unprefixed high-entropy protocol tokens/codes. @internal */
export function oauthProtocolTokenDigest(unprefixedToken: string): string {
	return createHash("sha256").update(unprefixedToken, "utf8").digest("base64url");
}

/** Retain one user/client family's invalidation fence; the key never comes from an external pairwise subject. @internal */
export async function lockOAuthRefreshFamily(tx: DatabaseTransaction, input: { clientId: string; principalId: string }) {
	const request = z.strictObject({ clientId: id, principalId: id }).parse(input);
	await tx.insert(oauthRefreshFamily).values({ clientId: request.clientId, authUserId: request.principalId }).onConflictDoNothing({ target: [oauthRefreshFamily.clientId, oauthRefreshFamily.authUserId] });
	const [family] = await tx.select().from(oauthRefreshFamily).where(and(eq(oauthRefreshFamily.clientId, request.clientId), eq(oauthRefreshFamily.authUserId, request.principalId))).for("update");
	if (!family) throw new OAuthGrantContextUnavailable();
	return family;
}

/** Advance the authenticated refresh family's epoch in constant work; token cleanup is separate. @internal */
export async function invalidateOAuthRefreshFamily(tx: DatabaseTransaction, input: { clientId: string; principalId: string }) {
	const family = await lockOAuthRefreshFamily(tx, input);
	if (!Number.isSafeInteger(family.epoch + 1)) throw new OAuthGrantContextUnavailable();
	await tx.update(oauthRefreshFamily).set({ epoch: family.epoch + 1 }).where(eq(oauthRefreshFamily.id, family.id));
	return family.epoch + 1;
}

/** Capture one explicit user consent for a newly authenticated authorization-code grant. @internal */
export async function createUserOAuthGrantContext(tx: DatabaseTransaction, input: z.infer<typeof envelope> & {
	principalId: string; consentId: string; authorizationCodeId: string;
}) {
	const request = envelope.extend({ principalId: id, consentId: id, authorizationCodeId: z.string().min(1).max(256) }).parse(input);
	const consent = await readUserConsentAdmission(tx, { consentId: request.consentId, clientId: request.clientId, principalId: request.principalId });
	for (const scope of request.scopes) {
		if (!consent.client.protocol.allowedScopes.includes(scope)) throw new OAuthGrantContextDenied();
		if (scope === "openid") continue;
		if (scope === "offline_access") {
			if (!consent.terms.offlineAccess || !consent.client.terms.offlineAccess) throw new OAuthGrantContextDenied();
		} else if (!consent.terms.capabilities.some(value => value.family === "api" && value.key === scope) ||
			!consent.client.terms.capabilities.some(value => value.family === "api" && value.key === scope)) throw new OAuthGrantContextDenied();
	}
	const offline = request.scopes.includes("offline_access");
	const family = offline ? await lockOAuthRefreshFamily(tx, { clientId: consent.client.protocol.id, principalId: request.principalId }) : null;
	const [created] = await tx.insert(oauthGrantContext).values({ kind: "user", clientId: consent.client.protocol.id, principalId: request.principalId,
		clientTermsRevision: consent.client.terms.revision, protocolCredentialEpoch: consent.client.protocol.credentialEpoch,
		clientCredentialEpoch: consent.client.client.credentialEpoch, appAuthorityEpoch: consent.client.app.authorityEpoch,
		consentId: consent.consent.id, consentTermsRevision: consent.terms.revision, refreshFamilyId: family?.id ?? null, refreshFamilyEpoch: family?.epoch ?? null,
		authorizationCodeId: request.authorizationCodeId, scopes: [...request.scopes].sort(), audiences: [...request.audiences].sort(), validUntil: consent.terms.validUntil }).returning();
	if (!created) throw new OAuthGrantContextUnavailable();
	return created;
}

/** Capture only the installation selected by the authenticated managed client; request data supplies no installation identity. @internal */
export async function createInstallationOAuthGrantContext(tx: DatabaseTransaction, input: z.infer<typeof envelope>) {
	const request = envelope.parse(input);
	const admitted = await readAppClientAdmission(tx, { clientId: request.clientId });
	if (admitted.client.kind !== "installation" || !admitted.installation || !admitted.installationApproval || !admitted.workload) throw new OAuthGrantContextDenied();
	for (const scope of request.scopes) {
		if (scope === "openid" || scope === "offline_access" || !admitted.protocol.clientCredentialsScopes.includes(scope) ||
			!admitted.terms.capabilities.some(value => value.family === "api" && value.key === scope) ||
			!admitted.installationApproval.capabilities.some(value => value.family === "api" && value.key === scope)) throw new OAuthGrantContextDenied();
	}
	const clock = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]?.now;
	const now = new Date(clock ?? "invalid").getTime();
	if (!Number.isFinite(now)) throw new OAuthGrantContextUnavailable();
	const validUntil = new Date(Math.min(now + 86_400_000, admitted.installationApproval.validUntil?.getTime() ?? Infinity));
	const [created] = await tx.insert(oauthGrantContext).values({ kind: "installation", clientId: admitted.protocol.id, principalId: admitted.workload.authUserId,
		clientTermsRevision: admitted.terms.revision, protocolCredentialEpoch: admitted.protocol.credentialEpoch,
		clientCredentialEpoch: admitted.client.credentialEpoch, appAuthorityEpoch: admitted.app.authorityEpoch,
		installationId: admitted.installation.id, installationApprovalRevision: admitted.installationApproval.revision,
		installationCredentialEpoch: admitted.installation.credentialEpoch, workloadCredentialEpoch: admitted.workload.credentialEpoch,
		scopes: [...request.scopes].sort(), audiences: [...request.audiences].sort(), validUntil }).returning();
	if (!created) throw new OAuthGrantContextUnavailable();
	return created;
}

/** Load the exact original grant with live native dependencies and retained fences. @internal */
export async function readOAuthGrantContext(tx: DatabaseTransaction, contextId: string) {
	contextId = id.parse(contextId);
	const [context] = await tx.select().from(oauthGrantContext).where(eq(oauthGrantContext.id, contextId)).for("share");
	if (!context || context.revokedAt !== null) throw new OAuthGrantContextDenied();
	// Resolve the public protocol identifier through its admitted client, never from principal claims.
	const rows = (await tx.execute<{ client_id: string }>(sql`select client_id from public.oauth_client_authority where id=${context.clientId}::uuid`)).rows;
	if (!rows[0]) throw new OAuthGrantContextUnavailable();
	const expected = { clientId: rows[0].client_id, protocolCredentialEpoch: context.protocolCredentialEpoch,
		clientCredentialEpoch: context.clientCredentialEpoch, clientTermsRevision: context.clientTermsRevision, appAuthorityEpoch: context.appAuthorityEpoch };
	const user = context.kind === "user" && context.consentId && context.consentTermsRevision
		? await readUserConsentAdmission(tx, { ...expected, principalId: context.principalId, consentId: context.consentId, termsRevision: context.consentTermsRevision }) : null;
	const installation = context.kind === "installation" && context.installationId && context.installationApprovalRevision !== null &&
		context.installationCredentialEpoch !== null && context.workloadCredentialEpoch !== null
		? await readAppClientAdmission(tx, { ...expected, installationId: context.installationId, installationApprovalRevision: context.installationApprovalRevision,
			installationCredentialEpoch: context.installationCredentialEpoch, workloadCredentialEpoch: context.workloadCredentialEpoch }) : null;
	if (context.kind === "user" ? !user : !installation || installation.workload?.authUserId !== context.principalId) throw new OAuthGrantContextUnavailable();
	if (context.refreshFamilyId !== null) {
		const [family] = await tx.select().from(oauthRefreshFamily).where(eq(oauthRefreshFamily.id, context.refreshFamilyId)).for("share");
		if (!family || family.epoch !== context.refreshFamilyEpoch) throw new OAuthGrantContextDenied();
	}
	const current = (await tx.execute<{ current: boolean | null }>(sql`select public.oauth_grant_context_is_current(${contextId}::uuid) as current`)).rows[0]?.current;
	if (current === false) throw new OAuthGrantContextDenied();
	if (current !== true) throw new OAuthGrantContextUnavailable();
	return { context, user, installation, admission: sql<boolean>`public.oauth_grant_context_is_current(${contextId}::uuid) is true` };
}

/** Select the captured context for provider token inserts in this transaction only. @internal */
export async function selectOAuthIssuanceContext(tx: DatabaseTransaction, contextId: string): Promise<void> {
	await readOAuthGrantContext(tx, contextId);
	await tx.execute(sql`select set_config('rezics.oauth_grant_context',${id.parse(contextId)},true)`);
}

/** Revoke one captured authorization-code context without deleting an unbounded token set. @internal */
export async function invalidateOAuthAuthorizationCode(tx: DatabaseTransaction, authorizationCodeId: string, clientId: string): Promise<void> {
	const value = z.string().min(1).max(256).parse(authorizationCodeId);
	const selectedClient = id.parse(clientId);
	await tx.execute(sql`update public.oauth_grant_context set revoked_at=clock_timestamp()
		where authorization_code_id=${value} and client_id=${selectedClient}::uuid and revoked_at is null`);
}
