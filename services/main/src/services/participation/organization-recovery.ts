import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { PrincipalRequestContext } from "../auth/principal-session";
import type { DatabaseTransaction } from "../database";
import { allocateAccessScope, resolveAccessSubject } from "../authorization/identities";
import { readManagementAuthority } from "../authorization/management-authority";
import { readAccessSubjectEligibility } from "../authorization/subject-eligibility";
import { requireAccessAdmission, runAccessTransaction } from "../authorization/transaction";
import {
	AccessChanged,
	AccessDenied,
	AccessRecordUnavailable,
	AccessUnavailable,
} from "../authorization/http-errors";
import { organizationEnrollmentOperation } from "@rezics/schema/postgres/access/organization-membership";
import { organizationEnrollmentContact } from "@rezics/schema/postgres/access/organization-membership";
import {
	accessRepresentation,
	accessRepresentationEntity,
} from "@rezics/schema/postgres/access/access-representation";
import { entityParticipation, entityRecoveryEvent } from "@rezics/schema/postgres/access/participation";
import { establishOrganizationEnrollmentControl } from "./organization-control";
import {
	organizationEnrollmentScope,
	membershipRecipients,
	membershipRecipientContext,
	lockOrganizationEnrollment,
} from "./membership-policy";
async function recoveryAuthority(tx: DatabaseTransaction, context: PrincipalRequestContext) {
	const scopeId = await allocateAccessScope(tx, { kind: "platform" });
	return readManagementAuthority(
		tx,
		{
			proof: context.credentialProof(),
			selection: context.selection,
			scopeId,
			path: ["organization-recovery"],
			permission: "access.membership.recover",
			apiPermission: "access:manage",
			requireFreshSession: true,
			mutation: true,
		},
		sql<boolean>`true`,
	);
}
/** Platform recovery can locate only recipients who explicitly shared a contact for this exact Org. @alpha */
export async function selectOrganizationRecoveryRecipient(
	context: PrincipalRequestContext,
	organizationEntityId: string,
	contact: string,
) {
	return runAccessTransaction(async (tx) => {
		const actor = await recoveryAuthority(tx, context),
			scope = await organizationEnrollmentScope(tx, organizationEntityId, false);
		const [row] = await tx
			.select()
			.from(organizationEnrollmentContact)
			.where(
				and(
					eq(organizationEnrollmentContact.scopeId, scope.scopeId),
					eq(
						organizationEnrollmentContact.secretDigest,
						createHash("sha256").update(contact).digest("hex"),
					),
				),
			)
			.for("share");
		if (!row || row.revokedAt || row.expiresAt <= new Date()) throw new AccessRecordUnavailable();
		const [eligible] = await readAccessSubjectEligibility(tx, {
			subjectIds: [row.subjectId],
			action: "write",
		});
		if (eligible?.outcome === "deny") throw new AccessDenied();
		if (eligible?.outcome !== "allow") throw new AccessUnavailable();
		await requireAccessAdmission(tx, actor.admission);
		return {
			selector: membershipRecipients.mint(
				row.subjectId,
				{ ...membershipRecipientContext(context, scope.scopeId), purpose: "organization-recovery" },
				Date.now(),
			),
			expiresAt: new Date(Date.now() + 300000).toISOString(),
		};
	});
}
export const RecoverNativeOrganizationSchema = z.strictObject({
	selector: z.string().min(1).max(512),
	expectedRevision: z.number().int().positive().safe(),
	evidence: z.string().trim().min(1).max(16384),
	operationId: z.uuid(),
});
/** Evidence-reviewed recovery revokes old native roots and creates explicit institutional control, never enrollment. @alpha */
export async function recoverNativeOrganization(
	context: PrincipalRequestContext,
	organizationEntityId: string,
	input: z.input<typeof RecoverNativeOrganizationSchema>,
) {
	const value = RecoverNativeOrganizationSchema.parse(input);
	if (Buffer.byteLength(value.evidence, "utf8") > 16384) throw new AccessDenied();
	return runAccessTransaction(async (tx) => {
		const actor = await recoveryAuthority(tx, context);
		const [control] = await tx
			.select()
			.from(entityParticipation)
			.where(eq(entityParticipation.entityId, organizationEntityId))
			.for("update");
		if (!control) throw new AccessChanged();
		const scope = await organizationEnrollmentScope(tx, organizationEntityId, false);
		await lockOrganizationEnrollment(tx, scope.scopeId);
		await tx
			.insert(accessRepresentationEntity)
			.values({ entityId: organizationEntityId })
			.onConflictDoNothing();
		await tx
			.select()
			.from(accessRepresentationEntity)
			.where(eq(accessRepresentationEntity.entityId, organizationEntityId))
			.for("update");
		const subjectId = membershipRecipients.resolve(
			value.selector,
			{ ...membershipRecipientContext(context, scope.scopeId), purpose: "organization-recovery" },
			Date.now(),
		);
		const recipient = await resolveAccessSubject(tx, subjectId);
		if (recipient?.kind !== "principal") throw new AccessRecordUnavailable();
		const [eligibility] = await readAccessSubjectEligibility(tx, {
			subjectIds: [subjectId],
			action: "write",
		});
		if (eligibility?.outcome === "deny") throw new AccessDenied();
		if (eligibility?.outcome !== "allow") throw new AccessUnavailable();
		const [contact] = await tx
			.select()
			.from(organizationEnrollmentContact)
			.where(
				and(
					eq(organizationEnrollmentContact.scopeId, scope.scopeId),
					eq(organizationEnrollmentContact.subjectId, subjectId),
					isNull(organizationEnrollmentContact.revokedAt),
					sql`${organizationEnrollmentContact.expiresAt}>clock_timestamp()`,
				),
			)
			.limit(1)
			.for("share");
		if (!contact || contact.expiresAt <= new Date()) throw new AccessDenied();
		const requestDigest = createHash("sha256")
			.update(
				JSON.stringify({
					organizationEntityId,
					subjectId,
					expectedRevision: value.expectedRevision,
					evidence: value.evidence,
				}),
			)
			.digest("hex");
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`org-enrollment-operation:${scope.scopeId}:${value.operationId}`},0))`,
		);
		const [prior] = await tx
			.select()
			.from(organizationEnrollmentOperation)
			.where(
				and(
					eq(organizationEnrollmentOperation.scopeId, scope.scopeId),
					eq(organizationEnrollmentOperation.operationId, value.operationId),
				),
			);
		if (prior) {
			if (
				prior.operatorAuthUserId !== actor.principalId ||
				prior.authoritySubjectId !== actor.subjectId ||
				prior.requestDigest !== requestDigest ||
				prior.recipientSubjectId !== subjectId
			)
				throw new AccessChanged();
			const result = z
				.strictObject({
					entityId: z.uuid(),
					revision: z.number().int().positive(),
					scopeId: z.uuid(),
					representation: z.strictObject({ id: z.uuid(), revision: z.number().int().positive() }),
				})
				.parse(prior.result);
			await requireAccessAdmission(tx, actor.admission);
			return result;
		}
		if (control.revision !== value.expectedRevision) throw new AccessChanged();
		// Recovery does not overthrow a currently eligible controller. A non-subject
		// source requires the existing governance review instead of an empty inference.
		const roots = await tx
			.select()
			.from(accessRepresentation)
			.where(
				and(
					eq(accessRepresentation.entityId, organizationEntityId),
					eq(accessRepresentation.state, "active"),
				),
			)
			.orderBy(accessRepresentation.id)
			.limit(257);
		if (roots.length > 256) throw new AccessUnavailable();
		for (const root of roots) {
			const live = (
				await tx.execute<{ live: boolean | null }>(
					sql`select public.access_representation_is_current(${root.id}::uuid,${root.termsRevision}) as live`,
				)
			).rows[0]?.live;
			if (live === null || live === undefined) throw new AccessUnavailable();
			if (!live) continue;
			if (!root.recipientSubjectId) throw new AccessUnavailable();
			const [current] = await readAccessSubjectEligibility(tx, {
				subjectIds: [root.recipientSubjectId],
				action: "write",
			});
			if (current?.outcome === "allow") throw new AccessDenied();
			if (current?.outcome !== "deny") throw new AccessUnavailable();
		}
		const admission = sql<boolean>`(${actor.admission}) and public.access_subject_is_eligible(${subjectId}::uuid,'write')
   and exists(select 1 from public.organization_enrollment_contact where id=${contact.id}::uuid and revoked_at is null and expires_at>clock_timestamp())`;
		await requireAccessAdmission(tx, admission);
		await tx
			.update(entityParticipation)
			.set({ state: "active", revision: control.revision + 1 })
			.where(eq(entityParticipation.entityId, organizationEntityId));
		const native = await establishOrganizationEnrollmentControl(
			tx,
			{
				entityId: organizationEntityId,
				recipientAuthUserId: recipient.id,
				operatorAuthUserId: actor.principalId,
				operationId: value.operationId,
				recover: true,
				authoritySubjectId: actor.subjectId,
			},
			admission,
		);
		if (!native) throw new AccessUnavailable();
		await tx
			.insert(entityRecoveryEvent)
			.values({
				entityId: organizationEntityId,
				revision: control.revision + 1,
				operatorAuthUserId: actor.principalId,
				recipientAuthUserId: recipient.id,
				evidence: value.evidence,
			});
		const result = { entityId: organizationEntityId, revision: control.revision + 1, ...native };
		await tx
			.insert(organizationEnrollmentOperation)
			.values({
				scopeId: scope.scopeId,
				operationId: value.operationId,
				operatorAuthUserId: actor.principalId,
				authoritySubjectId: actor.subjectId,
				recipientSubjectId: subjectId,
				requestDigest,
				result,
			});
		await requireAccessAdmission(tx, admission);
		return result;
	});
}
