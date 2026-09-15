import { groupAuthoritySourceDigest } from "../authorization/group-impact-evaluation";
import { resolveAccessSubject } from "../authorization/identities";
import { realmEnrollment, realmEnrollmentContact } from "../database/schema/realm-enrollment";
import { eq, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { PrincipalRequestContext } from "../auth/principal-session";
import { realm } from "../database/schema/realm";
import { accessGroupTree } from "../database/schema/access-group";
import { accessRoleBindingScope } from "../database/schema/access-role-binding";
import { allocateAccessScope } from "../authorization/identities";
import { allocateReferenceValue } from "../units/reference-value";
import { readManagementAuthority } from "../authorization/management-authority";
import { AccessChanged, AccessRecordUnavailable, AccessDenied } from "../authorization/http-errors";
import { requireAccessAdmission } from "../authorization/transaction";
import { currentRealmRuleRevisionReadLock } from "./rule-revision-lock";
export {
	enrollmentSubjectAuthority,
	membershipRecipients,
	membershipRecipientContext,
} from "../participation/membership-policy";

/** Retain current Realm resource and rule fences before reading enrollment policy. @internal */
export async function realmEnrollmentScope(
	tx: DatabaseTransaction,
	realmId: string,
	mutation: boolean,
	expectedControlRevision?: number,
) {
	await tx.execute(currentRealmRuleRevisionReadLock(realmId));
	const [record] = await tx.select().from(realm).where(eq(realm.id, realmId)).for("share");
	if (!record) throw new AccessRecordUnavailable();
	if (
		expectedControlRevision !== undefined &&
		record.membershipControlRevision !== expectedControlRevision
	)
		throw new AccessChanged();
	const scopeId = await allocateAccessScope(tx, {
		kind: "resource",
		referenceValueId: await allocateReferenceValue(tx, { owner: "realm", id: realmId }),
	});
	const admission = sql<boolean>`exists(select 1 from public.realm r where r.id=${realmId}::uuid and r.membership_control_revision=${record.membershipControlRevision})`;
	const enrollmentAdmission = sql<boolean>`(${admission}) and exists(select 1 from public.realm r where r.id=${realmId}::uuid and r.deleted_at is null and r.moderation_status='approved' and r.status='published')`;
	await requireAccessAdmission(tx, admission);
	if (mutation) {
		await tx.insert(accessRoleBindingScope).values({ scopeId }).onConflictDoNothing();
		await tx
			.select()
			.from(accessRoleBindingScope)
			.where(eq(accessRoleBindingScope.scopeId, scopeId))
			.for("update");
		await tx.insert(accessGroupTree).values({ scopeId }).onConflictDoNothing();
		await tx
			.select()
			.from(accessGroupTree)
			.where(eq(accessGroupTree.scopeId, scopeId))
			.for("update");
	}
	return { scopeId, record, admission, enrollmentAdmission };
}
/** Native mixed authority owns operational disclosure, invitations, approval and enforcement. @internal */
export async function realmMembershipAuthority(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	scope: Awaited<ReturnType<typeof realmEnrollmentScope>>,
	mutation: boolean,
	fresh = mutation,
) {
	return readManagementAuthority(
		tx,
		{
			proof: context.credentialProof(),
			selection: context.selection,
			scopeId: scope.scopeId,
			path: ["memberships"],
			permission: mutation ? "access.membership.manage" : "access.membership.read",
			apiPermission: mutation ? "access:manage" : "access:read",
			requireFreshSession: fresh,
			mutation,
		},
		scope.admission,
	);
}
/** Negative enforcement keys share the exact membership fence with all generation consumers. @internal */
export function realmRecipientAdmission(
	scopeId: string,
	subjectId: string,
	action: "read" | "write" | "contribute",
) {
	return sql<boolean>`public.access_subject_is_eligible(${subjectId}::uuid,${action}) and not exists(select 1 from public.realm_enforcement e where e.scope_id=${scopeId}::uuid and e.subject_id=${subjectId}::uuid and (e.state='banned' or (${action}='contribute' and e.state='muted')))`;
}

/** Revalidate the original invitation source and scoped disclosure consent under current fences. @internal */
export async function realmInvitationAdmission(
	tx: DatabaseTransaction,
	scope: Awaited<ReturnType<typeof realmEnrollmentScope>>,
	head: typeof realmEnrollment.$inferSelect,
) {
	if (
		head.state !== "invited" ||
		!head.invitation ||
		!head.consentExpiresAt ||
		head.policyRevision !== scope.record.membershipControlRevision
	)
		throw new AccessDenied();
	const context = new PrincipalRequestContext(
		head.invitation.principalId,
		head.invitation.selection,
		head.invitation.proof,
	);
	const manager = await realmMembershipAuthority(tx, context, scope, true, false);
	if (groupAuthoritySourceDigest(manager) !== head.invitation.sourceDigest)
		throw new AccessDenied();
	const subject = await resolveAccessSubject(tx, head.subjectId);
	if (!subject) throw new AccessRecordUnavailable();
	let contact = sql<boolean>`true`;
	if (subject.kind === "principal") {
		if (!head.invitationContactId) throw new AccessDenied();
		await tx
			.select({ id: realmEnrollmentContact.id })
			.from(realmEnrollmentContact)
			.where(eq(realmEnrollmentContact.id, head.invitationContactId))
			.for("share");
		contact = sql<boolean>`exists(select 1 from public.realm_enrollment_contact c where c.id=${head.invitationContactId}::uuid and c.requested_realm_id=${head.realmId}::uuid and c.subject_id=${head.subjectId}::uuid and c.revoked_at is null and c.expires_at>clock_timestamp())`;
	}
	const admission = sql<boolean>`(${scope.enrollmentAdmission}) and (${manager.admission}) and (${contact}) and clock_timestamp()<${head.consentExpiresAt}::timestamptz and (${realmRecipientAdmission(scope.scopeId, head.subjectId, "read")})`;
	await requireAccessAdmission(tx, admission);
	return admission;
}
