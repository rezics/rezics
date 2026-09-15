import { notifyRealmEnrollment } from "./membership-notifications";
import { recordAuditEvent } from "../audit";
import { RealmRulesAcceptanceRequired } from "../authorization/errors";
import { readFirstPartyCredentialAuthority } from "../auth/credential-authority";
import { createHash } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { PrincipalRequestContext } from "../auth/principal-session";
import {
	realmEnrollment,
	realmEnforcement,
	realmEnrollmentOperation,
	realmEnrollmentRuleAcceptance,
	realmEnrollmentContact,
} from "../database/schema/realm-enrollment";
import { accessMembership } from "../database/schema/access-membership";
import { unitFollow, unitOwnership } from "../database/schema";
import type { EnrollmentAuthorityEvidence } from "../database/schema/organization-membership";
import { allocateAccessSubject, resolveAccessSubject } from "../authorization/identities";
import { applyAccessMembershipCommand, readAccessMembership } from "../authorization/memberships";
import {
	AccessChanged,
	AccessDenied,
	AccessRecordUnavailable,
	AccessUnavailable,
} from "../authorization/http-errors";
import { requireAccessAdmission } from "../authorization/transaction";
import { groupAuthoritySourceDigest } from "../authorization/group-impact-evaluation";
import { prepareEnrollmentRecovery } from "../participation/membership-recovery";
import { allocateReferenceValue } from "../units/reference-value";
import { getCurrentRealmRules } from "./service";
import {
	realmEnrollmentScope,
	realmMembershipAuthority,
	enrollmentSubjectAuthority,
	membershipRecipients,
	membershipRecipientContext,
	realmRecipientAdmission,
	realmInvitationAdmission,
} from "./membership-policy";
import {
	JoinRealmSchema,
	RealmEnrollmentExpectedSchema,
	RealmEnrollmentCommandSchema,
	RealmRuleConsentSchema,
} from "./membership-contracts";

type Enrollment = typeof realmEnrollment.$inferSelect;
type Receipt = typeof realmEnrollmentOperation.$inferSelect.result;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
/** Database clock used after authority waits and before time-bound effects. @internal */
export async function enrollmentClock(tx: DatabaseTransaction) {
	const value = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`))
		.rows[0]?.now;
	if (!value) throw new AccessUnavailable();
	return new Date(value);
}
/** Present policy and shared-head outcomes without claiming effective permission. @internal */
export function presentEnrollment(
	head: Enrollment,
	member: typeof accessMembership.$inferSelect,
	enforcement?: typeof realmEnforcement.$inferSelect,
): Receipt {
	return {
		state: head.state === "approved" && member.activeGeneration === null ? "removed" : head.state,
		revision: head.revision,
		membershipId: member.id,
		version: member.version,
		activeGeneration: member.activeGeneration,
		lastGeneration: member.lastGeneration,
		enforcement: enforcement?.state ?? "clear",
		enforcementRevision: enforcement?.revision ?? 0,
	};
}
function evidence(
	context: PrincipalRequestContext,
	sourceDigest: string,
): EnrollmentAuthorityEvidence {
	return {
		principalId: context.principalId,
		selection: context.selection,
		proof: context.credentialProof(),
		sourceDigest,
	};
}
function restore(value: EnrollmentAuthorityEvidence) {
	return new PrincipalRequestContext(value.principalId, value.selection, value.proof);
}
/** Resolve only typed Entity identifiers or credential-bound private selectors. @internal */
export async function realmEnrollmentRecipient(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	scopeId: string,
	input: z.infer<typeof RealmEnrollmentCommandSchema>["recipient"],
) {
	const subjectId =
		input.kind === "entity"
			? await allocateAccessSubject(tx, { kind: "entity", id: input.entityId })
			: membershipRecipients.resolve(
					input.selector,
					membershipRecipientContext(context, scopeId),
					(await enrollmentClock(tx)).getTime(),
				);
	const subject = await resolveAccessSubject(tx, subjectId);
	if (!subject || subject.kind !== input.kind) throw new AccessRecordUnavailable();
	return { subjectId, subject };
}
/** All enrollment, consent and moderation effects share exact revisions, native authority and receipts. @internal */
async function command(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	realmId: string,
	input: z.infer<typeof RealmEnrollmentExpectedSchema>,
	operation:
		| "join"
		| "leave"
		| "acknowledge"
		| z.infer<typeof RealmEnrollmentCommandSchema>["operation"],
	options: {
		contactId?: string;
		recipient?: z.infer<typeof RealmEnrollmentCommandSchema>["recipient"];
		ruleRevisionId?: string | null;
		language?: z.infer<typeof RealmRuleConsentSchema>["language"];
	} = {},
) {
	const expected = RealmEnrollmentExpectedSchema.parse({
		operationId: input.operationId,
		expectedControlRevision: input.expectedControlRevision,
		expectedRevision: input.expectedRevision,
		expectedMembershipVersion: input.expectedMembershipVersion,
		expectedEnforcementRevision: input.expectedEnforcementRevision,
	});
	const scope = await realmEnrollmentScope(tx, z.uuid().parse(realmId), true);
	const self = ["join", "leave", "acknowledge"].includes(operation);
	const authority = self
		? await enrollmentSubjectAuthority(tx, context, true)
		: await realmMembershipAuthority(tx, context, scope, true);
	const recipient = self
		? {
				subjectId: authority.subjectId,
				subject: await resolveAccessSubject(tx, authority.subjectId),
			}
		: await realmEnrollmentRecipient(tx, context, scope.scopeId, options.recipient!);
	if (!recipient.subject) throw new AccessRecordUnavailable();
	const { subjectId, subject } = recipient;
	await tx.execute(
		sql`select public.lock_access_membership_key(${scope.scopeId}::uuid,${subjectId}::uuid,true)`,
	);
	const admission = sql<boolean>`(${scope.admission}) and (${authority.admission}) and (${operation === "leave" ? sql`true` : realmRecipientAdmission(scope.scopeId, authority.subjectId, "write")})`;
	await requireAccessAdmission(tx, admission);
	const request = {
		...expected,
		operation,
		subjectId,
		ruleRevisionId: options.ruleRevisionId ?? null,
		language: options.language ?? null,
		contactId: options.contactId ?? null,
	};
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`realm-enrollment-operation:${scope.scopeId}:${expected.operationId}`},0))`,
	);
	const [prior] = await tx
		.select()
		.from(realmEnrollmentOperation)
		.where(
			and(
				eq(realmEnrollmentOperation.scopeId, scope.scopeId),
				eq(realmEnrollmentOperation.operationId, expected.operationId),
			),
		);
	if (prior) {
		if (
			prior.requestDigest !== digest(request) ||
			prior.operatorAuthUserId !== context.principalId ||
			prior.authoritySubjectId !== authority.subjectId
		)
			throw new AccessChanged();
		await requireAccessAdmission(tx, admission);
		return prior.result;
	}
	if (scope.record.membershipControlRevision !== expected.expectedControlRevision)
		throw new AccessChanged();
	let member = await readAccessMembership(tx, { scopeId: scope.scopeId, subjectId });
	if (!member) {
		if (!["join", "invite", "ban", "mute", "clear", "acknowledge"].includes(operation))
			throw new AccessRecordUnavailable();
		const [created] = await tx
			.insert(accessMembership)
			.values({ scopeId: scope.scopeId, subjectId })
			.returning();
		if (!created) throw new AccessUnavailable();
		member = created;
	}
	let [head] = await tx
		.select()
		.from(realmEnrollment)
		.where(
			and(eq(realmEnrollment.scopeId, scope.scopeId), eq(realmEnrollment.subjectId, subjectId)),
		)
		.for("update");
	if (!head) {
		[head] = await tx
			.insert(realmEnrollment)
			.values({ scopeId: scope.scopeId, subjectId, realmId, membershipId: member.id })
			.returning();
	}
	if (!head) throw new AccessUnavailable();
	const [enforcement] = await tx
		.select()
		.from(realmEnforcement)
		.where(
			and(eq(realmEnforcement.scopeId, scope.scopeId), eq(realmEnforcement.subjectId, subjectId)),
		)
		.for("update");
	if (
		head.revision !== expected.expectedRevision ||
		member.version !== expected.expectedMembershipVersion ||
		(enforcement?.revision ?? 0) !== expected.expectedEnforcementRevision
	)
		throw new AccessChanged();
	if (subject.kind === "entity" && ["ban", "mute"].includes(operation)) {
		const [owner] = await tx
			.select({ id: unitOwnership.id })
			.from(unitOwnership)
			.where(
				and(
					eq(unitOwnership.unitRealmId, realmId),
					eq(unitOwnership.profileId, subject.id),
					sql`${unitOwnership.revokedAt} is null`,
				),
			)
			.for("share");
		if (owner) throw new AccessDenied();
	}
	const contactId =
		operation === "invite"
			? options.contactId
			: operation === "join" && head.state === "invited"
				? head.invitationContactId
				: undefined;
	if (contactId)
		await tx
			.select({ id: realmEnrollmentContact.id })
			.from(realmEnrollmentContact)
			.where(eq(realmEnrollmentContact.id, contactId))
			.for("share");
	const rules = await getCurrentRealmRules(realmId, tx);
	const now = await enrollmentClock(tx);
	const patch: Partial<typeof realmEnrollment.$inferInsert> = {
		revision: head.revision + 1,
		updatedAt: now,
	};
	const conditions: SQL<boolean | null>[] = [admission];
	const contactAdmission = (contactId: string) =>
		sql<boolean>`exists(select 1 from public.realm_enrollment_contact c where c.id=${contactId}::uuid and c.requested_realm_id=${realmId}::uuid and c.subject_id=${subjectId}::uuid and c.revoked_at is null and c.expires_at>clock_timestamp())`;
	if (["join", "invite", "approve"].includes(operation)) conditions.push(scope.enrollmentAdmission);
	let membershipOperation: "admit" | "leave" | "remove" | undefined;
	let acknowledgedRevision: string | null = null;
	let acknowledgementLanguage: z.infer<typeof RealmRuleConsentSchema>["language"] =
		options.language ?? null;
	let consentActor: { principalId: string; subjectId: string } | undefined;
	if (operation === "join") {
		if (options.ruleRevisionId !== null && options.ruleRevisionId !== rules?.revisionId)
			throw new AccessChanged();
		if (rules?.requireOnJoin && options.ruleRevisionId !== rules.revisionId)
			throw new RealmRulesAcceptanceRequired({
				realms: [{ realmId, revisionId: rules.revisionId }],
			});
		acknowledgedRevision = options.ruleRevisionId ?? null;
		if (acknowledgedRevision !== null && head.ruleRevisionId === acknowledgedRevision)
			acknowledgementLanguage = head.consent?.ruleLanguage ?? null;
		conditions.push(realmRecipientAdmission(scope.scopeId, subjectId, "write"));
		if (member.activeGeneration !== null) throw new AccessChanged();
		let managerJoin = false;
		if (scope.record.visibility === "private" && head.state !== "invited") {
			const manager = await realmMembershipAuthority(tx, context, scope, true);
			conditions.push(manager.admission);
			managerJoin = true;
		}
		if (head.state === "invited") conditions.push(await realmInvitationAdmission(tx, scope, head));
		patch.policyRevision = scope.record.membershipControlRevision;
		patch.notificationBasis = { principalId: context.principalId, selection: context.selection };
		patch.consent = evidence(
			context,
			(await enrollmentSubjectAuthority(tx, context, true)).sourceDigest,
		);
		patch.ruleRevisionId = acknowledgedRevision;
		if (patch.consent) patch.consent.ruleLanguage = acknowledgementLanguage;
		patch.consentExpiresAt = new Date(now.getTime() + 30 * 86400000);
		patch.state =
			scope.record.joinPolicy === "open" || head.state === "invited" || managerJoin
				? "approved"
				: "pending";
		if (patch.state === "approved") {
			membershipOperation = "admit";
			consentActor = { principalId: context.principalId, subjectId };
		}
	} else if (operation === "invite") {
		if (member.activeGeneration !== null || head.state === "pending") throw new AccessChanged();
		conditions.push(realmRecipientAdmission(scope.scopeId, subjectId, "write"));
		const manager = await realmMembershipAuthority(tx, context, scope, true);
		if (subject.kind === "principal") {
			if (!options.contactId) throw new AccessDenied();
			conditions.push(contactAdmission(options.contactId));
		}
		patch.invitationContactId = options.contactId ?? null;
		patch.policyRevision = scope.record.membershipControlRevision;
		patch.invitation = evidence(context, groupAuthoritySourceDigest(manager));
		patch.consent = null;
		patch.ruleRevisionId = null;
		patch.state = "invited";
		patch.consentExpiresAt = new Date(now.getTime() + 30 * 86400000);
	} else if (operation === "approve") {
		if (
			head.state !== "pending" ||
			!head.consent ||
			!head.consentExpiresAt ||
			head.policyRevision !== scope.record.membershipControlRevision ||
			(rules?.requireOnJoin && head.ruleRevisionId !== rules.revisionId)
		)
			throw new AccessChanged();
		const consent = await enrollmentSubjectAuthority(tx, restore(head.consent), true, false);
		if (consent.subjectId !== subjectId || consent.sourceDigest !== head.consent.sourceDigest)
			throw new AccessDenied();
		conditions.push(
			consent.admission,
			realmRecipientAdmission(scope.scopeId, subjectId, "write"),
			sql<boolean>`clock_timestamp()<${head.consentExpiresAt}::timestamptz`,
		);
		acknowledgedRevision = head.ruleRevisionId;
		acknowledgementLanguage = head.consent.ruleLanguage ?? null;
		patch.state = "approved";
		membershipOperation = "admit";
		consentActor = consent;
	} else if (operation === "reject") {
		if (head.state !== "pending" && head.state !== "invited") throw new AccessChanged();
		patch.state = "rejected";
		patch.consent = null;
		patch.invitation = null;
		patch.consentExpiresAt = null;
	} else if (operation === "leave" || operation === "remove") {
		if (member.activeGeneration === null && !["pending", "invited"].includes(head.state))
			throw new AccessChanged();
		if (subject.kind === "entity") {
			const [owner] = await tx
				.select({ id: unitOwnership.id })
				.from(unitOwnership)
				.where(
					and(
						eq(unitOwnership.unitRealmId, realmId),
						eq(unitOwnership.profileId, subject.id),
						sql`${unitOwnership.revokedAt} is null`,
					),
				)
				.for("share");
			if (owner) throw new AccessDenied();
		}
		patch.state = operation === "leave" ? "left" : "removed";
		patch.consent = null;
		patch.invitation = null;
		patch.consentExpiresAt = null;
		if (member.activeGeneration !== null) membershipOperation = operation;
	} else if (operation === "acknowledge") {
		if (!rules || options.ruleRevisionId !== rules.revisionId) throw new AccessChanged();
		if (
			scope.record.visibility === "private" &&
			member.activeGeneration === null &&
			head.state !== "invited"
		) {
			const manager = await realmMembershipAuthority(tx, context, scope, true);
			conditions.push(manager.admission);
		}
		patch.consent = evidence(
			context,
			(await enrollmentSubjectAuthority(tx, context, true)).sourceDigest,
		);
		patch.policyRevision = scope.record.membershipControlRevision;
		patch.consentExpiresAt =
			head.state === "invited" ? head.consentExpiresAt : new Date(now.getTime() + 30 * 86400000);
		conditions.push(realmRecipientAdmission(scope.scopeId, subjectId, "write"));
		consentActor = { principalId: context.principalId, subjectId };
		patch.ruleRevisionId = rules.revisionId;
		acknowledgedRevision = rules.revisionId;
		if (patch.consent) patch.consent.ruleLanguage = acknowledgementLanguage;
	}
	const finalAdmission = sql<boolean>`${sql.join(
		conditions.map((value) => sql`(${value})`),
		sql` and `,
	)}`;
	await requireAccessAdmission(tx, finalAdmission);
	const recovery = await prepareEnrollmentRecovery(tx, scope.scopeId, subjectId);
	const actorId = await allocateAccessSubject(tx, { kind: "principal", id: context.principalId });
	const credential = await readFirstPartyCredentialAuthority(tx, {
		proof: context.credentialProof(),
		selection: context.selection,
		apiPermission: "access:manage",
		requireFreshSession: true,
		requireVerifiedEmail: true,
	});
	// Departure/enforcement can intentionally end the authority used to authorize the pre-change effect.
	const postEffectAdmission = sql<boolean>`(${scope.admission}) and (${credential.admission})
  and public.access_subject_is_eligible(${actorId}::uuid,'write') and public.access_subject_is_eligible(${authority.subjectId}::uuid,'write')`;
	const mayEndSource = ["leave", "remove", "mute", "ban", "clear"].includes(operation);
	const memberSnapshot = member;
	return tx.transaction(async (work) => {
		let currentMember = memberSnapshot;
		if (membershipOperation) {
			await applyAccessMembershipCommand(
				work,
				{
					scopeId: scope.scopeId,
					subjectId,
					expectedVersion: currentMember.version,
					operationId: expected.operationId,
					operatorAuthUserId: context.principalId,
					authoritySubjectId: authority.subjectId,
					operation: membershipOperation,
				},
				finalAdmission,
			);
			currentMember = (await readAccessMembership(work, { scopeId: scope.scopeId, subjectId }))!;
			patch.generation = currentMember.activeGeneration;
		}
		if (consentActor && currentMember.activeGeneration !== null && acknowledgedRevision)
			await work
				.insert(realmEnrollmentRuleAcceptance)
				.values({
					membershipId: currentMember.id,
					generation: currentMember.activeGeneration,
					revisionId: acknowledgedRevision,
					operatorAuthUserId: consentActor.principalId,
					authoritySubjectId: subjectId,
					language: acknowledgementLanguage,
				})
				.onConflictDoNothing();
		let restriction = enforcement;
		if (operation === "mute" || operation === "ban" || operation === "clear") {
			const state = operation === "mute" ? "muted" : operation === "ban" ? "banned" : "clear";
			[restriction] = await work
				.insert(realmEnforcement)
				.values({
					scopeId: scope.scopeId,
					subjectId,
					state,
					revision: (enforcement?.revision ?? 0) + 1,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: [realmEnforcement.scopeId, realmEnforcement.subjectId],
					set: { state, revision: (enforcement?.revision ?? 0) + 1, updatedAt: now },
				})
				.returning();
		}
		const [changed] = await work
			.update(realmEnrollment)
			.set(patch)
			.where(
				and(
					eq(realmEnrollment.scopeId, scope.scopeId),
					eq(realmEnrollment.subjectId, subjectId),
					eq(realmEnrollment.revision, expected.expectedRevision),
				),
			)
			.returning();
		if (!changed) throw new AccessChanged();
		if (subject.kind === "entity" && (operation === "join" || operation === "leave")) {
			const reference = await allocateReferenceValue(work, { owner: "realm", id: realmId });
			if (operation === "join")
				await work
					.insert(unitFollow)
					.values({ followerProfileId: subject.id, targetReferenceId: reference })
					.onConflictDoNothing();
			else
				await work
					.delete(unitFollow)
					.where(
						and(
							eq(unitFollow.followerProfileId, subject.id),
							eq(unitFollow.targetReferenceId, reference),
						),
					);
		}
		const result = presentEnrollment(changed, currentMember, restriction);
		await work.insert(realmEnrollmentOperation).values({
			scopeId: scope.scopeId,
			operationId: expected.operationId,
			subjectId,
			operatorAuthUserId: context.principalId,
			authoritySubjectId: authority.subjectId,
			requestDigest: digest(request),
			revision: changed.revision,
			operation,
			result,
		});
		await recordAuditEvent(work, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "auth", authUserId: context.principalId },
			authority: { kind: "realm", id: realmId },
			action: "realm.members.update",
			target: { kind: "realm_enrollment", id: currentMember.id },
			details: { operation, operationId: expected.operationId, revision: changed.revision },
		});
		if (!self)
			await notifyRealmEnrollment(work, {
				realmId,
				operationId: expected.operationId,
				actorEntityId: context.selection.mode === "represented" ? context.selection.entityId : null,
				recipient: subject,
				basis: changed.notificationBasis,
			});
		await recovery(work);
		await requireAccessAdmission(work, mayEndSource ? postEffectAdmission : finalAdmission);
		return result;
	});
}
/** Join the explicitly selected subject with exact rules and consent. Pending applications grant nothing. @alpha */
export function joinRealm(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	realmId: string,
	input: z.input<typeof JoinRealmSchema>,
) {
	const value = JoinRealmSchema.parse(input);
	return command(tx, context, realmId, value, "join", { ruleRevisionId: value.ruleRevisionId });
}
/** End the selected subject's current generation and retain enforcement/history. @alpha */
export function leaveRealm(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	realmId: string,
	input: z.input<typeof RealmEnrollmentExpectedSchema>,
) {
	return command(tx, context, realmId, RealmEnrollmentExpectedSchema.parse(input), "leave");
}
/** Native manager commands never manufacture recipient consent. @alpha */
export function updateRealmMember(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	realmId: string,
	input: z.input<typeof RealmEnrollmentCommandSchema>,
) {
	const value = RealmEnrollmentCommandSchema.parse(input);
	return command(tx, context, realmId, value, value.operation, {
		recipient: value.recipient,
		contactId: value.contactId,
	});
}
/** Acknowledge one exact current revision for the selected active generation. @alpha */
export function acknowledgeRealmRules(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	realmId: string,
	revisionId: string,
	input: z.input<typeof RealmRuleConsentSchema>,
) {
	const value = RealmRuleConsentSchema.parse(input);
	return command(tx, context, realmId, value, "acknowledge", {
		ruleRevisionId: z.uuid().parse(revisionId),
		language: value.language,
	});
}
