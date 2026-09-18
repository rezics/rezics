import { eq, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { users } from "@rezics/schema/postgres/identity/auth";
import type { PrincipalRequestContext } from "../auth/principal-session";
import { readFirstPartyCredentialAuthority } from "../auth/credential-authority";
import { allocateAccessSubject } from "./identities";
import { readAccessSubjectEligibility } from "./subject-eligibility";
import { AccessDenied, AccessUnavailable } from "./http-errors";

/**
 * Admit direct ownership of private account preferences independently from public identity.
 * @internal
 * @remarks Delegated account administration has a different target/action policy.
 * Callers retain this transaction and use admission at the final protected effect.
 */
export async function readPrivateAccountAuthority(tx: DatabaseTransaction, context: PrincipalRequestContext, mutation: boolean) {
	if (context.selection.mode !== "direct") throw new AccessDenied();
	const query = tx.select({ id: users.id }).from(users).where(eq(users.id, context.principalId));
	const [account] = mutation ? await query.for("update") : await query.for("share");
	if (!account) throw new AccessDenied();
	const credential = await readFirstPartyCredentialAuthority(tx, { proof: context.credentialProof(), selection: context.selection,
		apiPermission: mutation ? "account:update" : "account:read", requireFreshSession: false, requireVerifiedEmail: mutation });
	const subjectId = await allocateAccessSubject(tx, { kind: "principal", id: context.principalId });
	const action = mutation ? "write" : "read";
	const [eligibility] = await readAccessSubjectEligibility(tx, { subjectIds: [subjectId], action });
	if (eligibility?.outcome === "deny") throw new AccessDenied();
	if (eligibility?.outcome !== "allow") throw new AccessUnavailable();
	const admission = sql<boolean>`(${credential.admission}) and public.access_subject_is_eligible(${subjectId}::uuid,${action}) is true`;
	return { principalId: context.principalId, subjectId, credential, admission };
}
