import Elysia from "elysia";
import type { RequestedAuthoritySelection } from "@rezics/access";
import { RequestedAuthoritySelectionSchema } from "../authorization/authority-context";
import { runAccessTransaction } from "../authorization/transaction";
import { AccessInputInvalid } from "../authorization/http-errors";
import { setAuditCredentialContext } from "../audit";
import { personalApiKeyBearer, verifyInteractivePrincipal, verifyPersonalApiKey } from "./authentication";
import { readApiKeyAuthorityMetadata, readFirstPartyCredentialAuthority, type FirstPartyCredentialProof } from "./credential-authority";
import type { ApiPermission } from "./api-permissions";
import { enforceApiQuota } from "./api-quota/limit-store";
import { apiRouteOperationId, resolveApiQuotaOperation } from "./api-quota/operation";
import { getApiTokenQuotaOverride, resolveApiAccountQuotaPolicy, resolveApiTokenQuotaPolicy } from "./api-quota/policy-service";
import { AuthenticationRequired, InteractiveSessionRequired } from "./errors";
import session, { trackRequestLimitLease } from "./session";

/** Explicit authority selection, independent from public presentation or mutable defaults. @internal */
export function requestedAuthorityHeader(headers: Headers): RequestedAuthoritySelection | undefined {
	const raw = headers.get("X-Rezics-Authority");
	if (raw === null) return undefined;
	try {
		if (Buffer.byteLength(raw, "utf8") > 8192) throw new AccessInputInvalid();
		return RequestedAuthoritySelectionSchema.parse(JSON.parse(raw));
	} catch { throw new AccessInputInvalid(); }
}
/** Private authenticated context; credential digests cannot appear through object serialization. @internal */
export class PrincipalRequestContext {
	readonly #proof: FirstPartyCredentialProof;
	constructor(readonly principalId: string, readonly selection: RequestedAuthoritySelection, proof: FirstPartyCredentialProof) {
		if (proof.principalId !== principalId) throw new AuthenticationRequired();
		this.#proof = Object.freeze({ ...proof });
	}
	/** Revalidate this proof inside every protected effect's transaction. @internal */
	credentialProof(): Readonly<FirstPartyCredentialProof> { return this.#proof; }
}

/** Management/account entry policy; domain and recipient authorization remain with their owners. @internal */
export interface PrincipalAccessPolicy {
	permission: ApiPermission | null;
	fresh: boolean;
	write: boolean;
}

export default new Elysia({ name: "principal-session-context" }).use(session).macro({
	principalAccess: (policy: PrincipalAccessPolicy) => ({
		detail: { security: policy.permission === null || policy.fresh ? [{ SessionCookie: [] }] : [{ ApiToken: [] }, { SessionCookie: [] }] },
		async derive({ request, route, set }) {
			set.headers["Cache-Control"] = "private, no-store";
			const rawKey = personalApiKeyBearer(request.headers), requested = requestedAuthorityHeader(request.headers);
			let proof: FirstPartyCredentialProof, selection: RequestedAuthoritySelection;
			if (rawKey) {
				if (policy.permission === null || policy.fresh) throw new InteractiveSessionRequired();
				const verified = await verifyPersonalApiKey(rawKey, policy.permission);
				const authority = readApiKeyAuthorityMetadata(JSON.stringify(verified.key.metadata) ?? null);
				proof = verified.proof;
				selection = requested ?? (authority.mode === "operator" ? { mode: "direct" } : authority);
				await runAccessTransaction(tx => readFirstPartyCredentialAuthority(tx, { proof, selection,
					apiPermission: policy.permission, requireFreshSession: policy.fresh, requireVerifiedEmail: policy.write }));
				const [accountPolicy, tokenPolicy, safeguard] = await Promise.all([
					resolveApiAccountQuotaPolicy(proof.principalId), resolveApiTokenQuotaPolicy(proof.id), getApiTokenQuotaOverride(proof.id),
				]);
				const lease = await enforceApiQuota({ accountUserId: proof.principalId, tokenId: proof.id,
					operation: resolveApiQuotaOperation(apiRouteOperationId(request.method, route ?? "unmatched")),
					accountPolicy, tokenPolicy, tokenSafeguard: safeguard?.configurationOverride });
				trackRequestLimitLease(request, lease);
			} else {
				const verified = await verifyInteractivePrincipal(request.headers);
				if (!verified) throw new InteractiveSessionRequired();
				proof = verified.proof; selection = requested ?? { mode: "direct" };
				await runAccessTransaction(tx => readFirstPartyCredentialAuthority(tx, { proof, selection,
					apiPermission: policy.permission, requireFreshSession: policy.fresh, requireVerifiedEmail: policy.write }));
			}
			setAuditCredentialContext({ authUserId: proof.principalId, credentialKind: proof.kind === "session" ? "session" : "api_token", credentialId: proof.id });
			return { principalContext: new PrincipalRequestContext(proof.principalId, selection, proof) };
		},
	}),
});
