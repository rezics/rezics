import { createHash } from "node:crypto";
import { eq, sql, type SQL } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { PrincipalRequestContext } from "../auth/principal-session";
import { readFirstPartyCredentialAuthority } from "../auth/credential-authority";
import { allocateAccessScope, allocateAccessSubject } from "../authorization/identities";
import { allocateReferenceValue } from "../units/reference-value";
import { readManagementAuthority } from "../authorization/management-authority";
import { readAccessSubjectEligibility } from "../authorization/subject-eligibility";
import { requireAccessAdmission } from "../authorization/transaction";
import { createPrivateRecipientSelectors } from "../authorization/recipient-selectors";
import {
	AccessDenied,
	AccessRecordUnavailable,
	AccessUnavailable,
} from "../authorization/http-errors";
import { accessRoleBindingScope } from "../database/schema/access-role-binding";
import { accessGroupTree } from "../database/schema/access-group";
import { entityParticipation } from "../database/schema/participation";
import { entityIdentity } from "../database/schema/catalog-identity";
import { env } from "../config";
export const membershipRecipients = createPrivateRecipientSelectors(
	Buffer.from(env.BETTER_AUTH_SECRET),
);
/** Exact credential, selected authority and purpose bind every private enrollment selector. @internal */
export function membershipRecipientContext(context: PrincipalRequestContext, scopeId: string) {
	return {
		principalId: context.principalId,
		selection: context.selection,
		scopeId,
		purpose: "membership" as const,
		audience: createHash("sha256").update(JSON.stringify(context.credentialProof())).digest("hex"),
	};
}
/** Resolve the Org's canonical resource root and retain its lifecycle fence. @internal */
export async function organizationEnrollmentScope(
	tx: DatabaseTransaction,
	organizationEntityId: string,
	mutation: boolean,
) {
	const [entity] = await tx
		.select()
		.from(entityIdentity)
		.where(eq(entityIdentity.id, organizationEntityId))
		.for("share");
	const [control] = await tx
		.select()
		.from(entityParticipation)
		.where(eq(entityParticipation.entityId, organizationEntityId))
		.for("share");
	if (!entity || entity.shape !== "organization" || entity.deletedAt || !control)
		throw new AccessRecordUnavailable();
	const scopeId = await allocateAccessScope(tx, {
		kind: "resource",
		referenceValueId: await allocateReferenceValue(tx, {
			owner: "entity",
			id: organizationEntityId,
		}),
	});
	const admission = sql<boolean>`exists(select 1 from public.entity_participation p join public.entity_identity e on e.id=p.entity_id
 where p.entity_id=${organizationEntityId}::uuid and p.state='active' and p.revision=${control.revision} and e.shape='organization' and e.deleted_at is null)`;
	if (mutation) await requireAccessAdmission(tx, admission);
	return { scopeId, revision: control.revision, admission };
}
/** Promote overlapping scope, tree and pair fences before management/representation discovery. @internal */
export async function lockOrganizationEnrollment(
	tx: DatabaseTransaction,
	scopeId: string,
	subjectId?: string,
) {
	await tx
		.select()
		.from(accessRoleBindingScope)
		.where(eq(accessRoleBindingScope.scopeId, scopeId))
		.for("update");
	await tx.insert(accessGroupTree).values({ scopeId }).onConflictDoNothing();
	await tx.select().from(accessGroupTree).where(eq(accessGroupTree.scopeId, scopeId)).for("update");
	if (subjectId)
		await tx.execute(
			sql`select public.lock_access_membership_key(${scopeId}::uuid,${subjectId}::uuid,true)`,
		);
}
/** Current native mixed management; public Self and old participation grants are not admission. @internal */
export async function organizationMembershipAuthority(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	scopeId: string,
	admission: SQL<boolean | null>,
	mutation: boolean,
	fresh = mutation,
) {
	return readManagementAuthority(
		tx,
		{
			proof: context.credentialProof(),
			selection: context.selection,
			scopeId,
			path: ["memberships"],
			permission: mutation ? "access.membership.manage" : "access.membership.read",
			apiPermission: mutation ? "access:manage" : "access:read",
			requireFreshSession: fresh,
			mutation,
		},
		admission,
	);
}
/** Consent and inbox belong to the selected subject; Entity consent is an explicit represented operation. @internal */
export async function enrollmentSubjectAuthority(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	mutation: boolean,
) {
	const credential = await readFirstPartyCredentialAuthority(tx, {
		proof: context.credentialProof(),
		selection: context.selection,
		apiPermission: mutation ? "access:manage" : "access:read",
		requireFreshSession: mutation,
		requireVerifiedEmail: mutation,
	});
	const actorId = await allocateAccessSubject(tx, { kind: "principal", id: context.principalId });
	if (context.selection.mode === "represented") {
		const entityId = context.selection.entityId;
		const scopeId = await allocateAccessScope(tx, {
			kind: "resource",
			referenceValueId: await allocateReferenceValue(tx, { owner: "entity", id: entityId }),
		});
		const authority = await readManagementAuthority(
			tx,
			{
				proof: context.credentialProof(),
				selection: context.selection,
				scopeId,
				path: ["memberships"],
				permission: "access.membership.participate",
				apiPermission: mutation ? "access:manage" : "access:read",
				requireFreshSession: mutation,
				mutation,
			},
			sql<boolean>`true`,
		);
		if (authority.subject.kind !== "entity" || authority.subject.id !== entityId)
			throw new AccessDenied();
		return {
			subjectId: authority.subjectId,
			principalId: context.principalId,
			admission: authority.admission,
		};
	}
	const [eligibility] = await readAccessSubjectEligibility(tx, {
		subjectIds: [actorId],
		action: mutation ? "write" : "read",
	});
	if (eligibility?.outcome === "deny") throw new AccessDenied();
	if (eligibility?.outcome !== "allow") throw new AccessUnavailable();
	const admission = sql<boolean>`(${credential.admission}) and public.access_subject_is_eligible(${actorId}::uuid,${mutation ? "write" : "read"})
 and exists(select 1 from public.users where id=${context.principalId}::uuid and principal_kind='human')`;
	await requireAccessAdmission(tx, admission);
	return { subjectId: actorId, principalId: context.principalId, admission };
}
