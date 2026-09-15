import { createHash } from "node:crypto";
import { createDpopReplayStore, createInsufficientScopeError, enforceDpopBinding, isDpopBindingError,
	isDpopProofError, parseAccessTokenAuthorization } from "better-auth/oauth2";
import { APIError } from "better-auth/api";
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { ResourceUriSchema } from "@better-auth/oauth-provider";
import type { DatabaseTransaction } from "../database";
import { verifications } from "../database/schema/auth";
import { requireAccessAdmission, rethrowAccessFailure } from "../authorization/transaction";
import { AccessChanged, AccessDenied, AccessUnavailable } from "../authorization/http-errors";
import { AuthorityOperationSchema } from "../authorization/authority-context";
import { readUserConsentOperationAuthority } from "../connected-apps/user-authority";
import { readInstallationOperationAuthority } from "../connected-apps/installation-authority";
import { readOAuthAccessTokenContext } from "./oauth-token-context";
import { ApiPermissionValues, type ApiPermission } from "./api-permissions";

const confirmation = z.strictObject({ jkt: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
type NativeToken = Awaited<ReturnType<typeof readOAuthAccessTokenContext>>;

function invalidToken() {
	return new APIError("UNAUTHORIZED", { error: "invalid_token", error_description: "Invalid access token" });
}

/**
 * An opaque credential admitted by the local issuer and sender-proof verifier.
 * @internal
 * @remarks Private fields prevent accidental JSON disclosure. It is valid only
 * inside the caller's retained transaction; every domain operation still needs
 * consent/installation authority, resource restrictions and quota. It is never a
 * serialized bearer proof and cannot be reconstructed from external claims.
 */
export class OAuthResourceCredential {
	readonly #token: NativeToken;
	readonly #tx: DatabaseTransaction;
	private constructor(tx: DatabaseTransaction, token: NativeToken) { this.#tx = tx; this.#token = token; }
	get tokenId() { return this.#token.tokenId; }
	get principalId() { return this.#token.grant.context.principalId; }
	get kind() { return this.#token.grant.context.kind; }
	get clientId() { return this.#token.grant.context.clientId; }
	get installationId() { return this.#token.grant.context.installationId; }
	get expiresAt() { return new Date(this.#token.expiresAt.getTime()); }

	/** Revalidate the admitted token before resolving a later operation in the same transaction. @internal */
	async #current(permission: ApiPermission): Promise<NativeToken> {
		permission = z.enum(ApiPermissionValues).parse(permission);
		try { await requireAccessAdmission(this.#tx, this.#token.admission); }
		catch (error) { if (error instanceof AccessDenied) throw invalidToken(); throw error; }
		if (!this.#token.scopes.includes(permission)) throw createInsufficientScopeError([permission]);
		return this.#token;
	}

	/**
	 * Compose current delegated authority with the resource owner's domain admission.
	 * @internal
	 * @remarks The read-only resource resolver receives the exact selected subject
	 * and must check its actual rights, restrictions and structural invariants in
	 * this transaction. For installations,
	 * the approved frozen RoleBinding is also required. Quota remains separate.
	 * Supply the actual target root/path, including the owner's inherited-root policy.
	 */
	async authorize(input: { operation: z.infer<typeof AuthorityOperationSchema>; apiPermission: ApiPermission;
		action: "read" | "write" | "contribute"; requirePublicAttribution: boolean },
		resolveResourceAdmission: (subject: { subjectId: string; principalId: string; attributionEntityId: string | null }) => Promise<SQL<boolean | null>>) {
		const options = z.strictObject({ operation: AuthorityOperationSchema, apiPermission: z.enum(ApiPermissionValues),
			action: z.enum(["read", "write", "contribute"]), requirePublicAttribution: z.boolean() }).parse(input);
		const token = await this.#current(options.apiPermission);
		const { user, installation } = token.grant;
		let subjectId: string, attributionEntityId: string | null, authorityAdmission: SQL<boolean | null>, authorityValidUntil: number | null;
		if (token.grant.context.kind === "user" && user) {
			const authority = await readUserConsentOperationAuthority(this.#tx, user, {
				operation: options.operation, apiPermission: options.apiPermission, action: options.action });
			if (options.requirePublicAttribution && (user.subject.kind !== "entity" || !user.terms.entityDisclosure || !user.client.terms.entityDisclosure))
				throw new AccessDenied();
			subjectId = user.subjectId;
			attributionEntityId = options.requirePublicAttribution && user.subject.kind === "entity" ? user.subject.id : null;
			authorityAdmission = authority.admission; authorityValidUntil = authority.validUntil;
		} else if (token.grant.context.kind === "installation" && installation) {
			const authority = await readInstallationOperationAuthority(this.#tx, installation, options);
			subjectId = authority.subjectId; attributionEntityId = authority.attributionEntityId;
			authorityAdmission = authority.admission; authorityValidUntil = authority.validUntil;
		} else throw new AccessUnavailable();
		const resourceAdmission = await resolveResourceAdmission({ subjectId, principalId: this.principalId, attributionEntityId });
		const validUntil = Math.min(token.expiresAt.getTime(), authorityValidUntil ?? Infinity);
		const admission = sql<boolean>`(${token.admission}) and (${authorityAdmission}) and (${resourceAdmission})
			and clock_timestamp()<${new Date(validUntil)}::timestamptz`;
		await requireAccessAdmission(this.#tx, admission);
		return { principalId: this.principalId, subjectId, attributionEntityId, installationId: this.installationId,
			validUntil, admission };
	}

	/**
	 * Verify audience, current native grant, scheme and DPoP method/URL/ath/key/replay.
	 * @internal
	 * @remarks Only this local issuer's opaque rows are accepted. There is no JWT,
	 * ID-token, personal-key or cookie fallback. The request URL must already be the
	 * trusted public URL; arbitrary forwarding headers must not redefine proof htu.
	 */
	static async verify(tx: DatabaseTransaction, request: Request, input: { audience: string; apiPermission: ApiPermission }): Promise<OAuthResourceCredential> {
		const options = z.strictObject({ audience: ResourceUriSchema, apiPermission: z.enum(ApiPermissionValues) }).parse(input);
		const header = request.headers.get("Authorization");
		const proofJwt = request.headers.get("DPoP");
		if (!header || header.length > 1024 || (proofJwt !== null && proofJwt.length > 16_384) || request.url.length > 8192) throw invalidToken();
		const authorization = parseAccessTokenAuthorization(header);
		if (!authorization || authorization.scheme === "Unknown") throw invalidToken();
		let token: NativeToken;
		try { token = await readOAuthAccessTokenContext(tx, { token: authorization.token, audience: options.audience }); }
		catch (error) {
			try { rethrowAccessFailure(error); }
			catch (translated) {
				if (translated instanceof AccessDenied) throw invalidToken();
				if (translated instanceof AccessUnavailable || translated instanceof AccessChanged)
					throw new APIError("SERVICE_UNAVAILABLE", { error: "temporarily_unavailable", error_description: "Access-token policy is unavailable" });
				throw translated;
			}
		}
		const parsedConfirmation = token.confirmation === null ? null : confirmation.safeParse(token.confirmation);
		// Unsupported confirmation types cannot silently become an ordinary bearer.
		if (parsedConfirmation !== null && !parsedConfirmation.success)
			throw new APIError("SERVICE_UNAVAILABLE", { error: "temporarily_unavailable", error_description: "Access-token proof policy is unavailable" });
		try {
			await enforceDpopBinding({
				payload: parsedConfirmation?.success ? { cnf: parsedConfirmation.data } : {}, authorization, proofJwt,
				method: request.method, url: request.url, replayStore: createDpopReplayStore({
					async reserveVerificationValue(data) {
						// The provider's base64 ID is replaced by the UUID adapter, losing replay identity.
						// A deterministic 128-bit digest and ON CONFLICT retain one winner without aborting tx.
						const digest = createHash("sha256").update(`reserve:${data.identifier}`).digest("hex").slice(0, 32);
						const [reserved] = await tx.insert(verifications).values({ ...data, id: sql`${digest}::uuid` })
							.onConflictDoNothing({ target: verifications.id }).returning({ id: verifications.id });
						return reserved !== undefined;
					},
				}),
				proofMaxAgeSeconds: 60,
			});
		} catch (error) {
			if (isDpopBindingError(error) || isDpopProofError(error))
				throw new APIError("UNAUTHORIZED", { error: error.code, error_description: "Access-token sender proof is invalid" });
			throw error;
		}
		try { await requireAccessAdmission(tx, token.admission); }
		catch (error) { if (error instanceof AccessDenied) throw invalidToken(); throw error; }
		if (!token.scopes.includes(options.apiPermission)) throw createInsufficientScopeError([options.apiPermission]);
		return new OAuthResourceCredential(tx, token);
	}
}
