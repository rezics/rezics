import { publicEntityName } from "./presentation";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { PrincipalRequestContext } from "../auth/principal-session";
import { users } from "@rezics/schema/postgres/identity/auth";
import { accessMembership, accessMembershipEvent } from "@rezics/schema/postgres/access/access-membership";
import {
	organizationEnrollmentInvitation as invitations,
	organizationEnrollmentContact as contacts,
	organizationEnrollmentOperation as operations,
} from "@rezics/schema/postgres/access/organization-membership";
import { allocateAccessSubject, resolveAccessSubject } from "../authorization/identities";
import { readAccessSubjectEligibility } from "../authorization/subject-eligibility";
import { applyAccessMembershipCommand, readAccessMembership } from "../authorization/memberships";
import {
	AccessDenied,
	AccessUnavailable,
	AccessRecordUnavailable,
} from "../authorization/http-errors";
import { requireAccessAdmission, rethrowAccessFailure } from "../authorization/transaction";
import {
	organizationEnrollmentScope,
	lockOrganizationEnrollment,
	organizationMembershipAuthority,
	enrollmentSubjectAuthority,
	membershipRecipients,
	membershipRecipientContext,
} from "./membership-policy";
import {
	AcceptMembershipInvitationSchema,
	CreateMembershipInvitationSchema,
	MembershipDepartureSchema,
	MembershipExpectedRevisionSchema,
	MembershipPageQuerySchema,
	MembershipRecipientSchema,
	RemoveMembershipSchema,
	OrganizationMembershipCapacityExceeded,
	OrganizationMembershipConflict,
	OrganizationMembershipNotFound,
} from "./membership-contracts";
import { readFirstPartyCredentialAuthority } from "../auth/credential-authority";
import { groupAuthoritySourceDigest } from "../authorization/group-impact-evaluation";
import { prepareEnrollmentRecovery } from "./membership-recovery";
type Invitation = typeof invitations.$inferSelect;
type Result = typeof operations.$inferInsert.result;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const digestSecret = (value: string) => createHash("sha256").update(value).digest("hex");
const Day = 86400000;
async function clock(tx: DatabaseTransaction) {
	const value = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`))
		.rows[0]?.now;
	if (!value) throw new AccessUnavailable();
	return new Date(value);
}
function presentRecipient(
	context: PrincipalRequestContext,
	scopeId: string,
	subjectId: string,
	subject: { kind: "entity" | "principal"; id: string },
	now: Date,
) {
	return subject.kind === "entity"
		? { kind: "entity" as const, entityId: subject.id }
		: {
				kind: "principal" as const,
				selector: membershipRecipients.mint(
					subjectId,
					membershipRecipientContext(context, scopeId),
					now.getTime(),
				),
			};
}
async function recipient(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	scopeId: string,
	input: z.input<typeof MembershipRecipientSchema>,
) {
	const value = MembershipRecipientSchema.parse(input);
	const subjectId =
		value.kind === "entity"
			? await allocateAccessSubject(tx, { kind: "entity", id: value.entityId })
			: membershipRecipients.resolve(
					value.selector,
					membershipRecipientContext(context, scopeId),
					(await clock(tx)).getTime(),
				);
	const subject = await resolveAccessSubject(tx, subjectId);
	if (!subject || subject.kind !== value.kind) throw new AccessRecordUnavailable();
	return { subjectId, subject };
}
async function receipt(
	tx: DatabaseTransaction,
	scopeId: string,
	operationId: string,
	principalId: string,
	subjectId: string,
	request: unknown,
) {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`org-enrollment-operation:${scopeId}:${operationId}`},0))`,
	);
	const [prior] = await tx
		.select()
		.from(operations)
		.where(and(eq(operations.scopeId, scopeId), eq(operations.operationId, operationId)));
	if (!prior) return null;
	if (
		prior.operatorAuthUserId !== principalId ||
		prior.authoritySubjectId !== subjectId ||
		prior.requestDigest !== hash(request)
	)
		throw new OrganizationMembershipConflict();
	return prior.result;
}
async function record(
	tx: DatabaseTransaction,
	scopeId: string,
	operationId: string,
	principalId: string,
	subjectId: string,
	recipientSubjectId: string,
	request: unknown,
	result: Result,
) {
	await tx
		.insert(operations)
		.values({
			scopeId,
			operationId,
			operatorAuthUserId: principalId,
			authoritySubjectId: subjectId,
			recipientSubjectId,
			requestDigest: hash(request),
			invitationId: result.invitationId ?? null,
			result,
		});
	return result;
}
async function eligible(tx: DatabaseTransaction, subjectId: string, action: "read" | "write") {
	const [value] = await readAccessSubjectEligibility(tx, { subjectIds: [subjectId], action });
	if (!value) throw new AccessUnavailable();
	return value.outcome;
}
async function requireEligible(
	tx: DatabaseTransaction,
	subjectId: string,
	action: "read" | "write",
) {
	const outcome = await eligible(tx, subjectId, action);
	if (outcome === "deny") throw new AccessDenied();
	if (outcome !== "allow") throw new AccessUnavailable();
}
function liveRecipient(subjectId: string) {
	return sql<boolean>`public.access_subject_is_eligible(${subjectId}::uuid,'write') and exists(select 1 from public.access_subject s left join public.users u on u.id=s.auth_user_id where s.id=${subjectId}::uuid and (s.entity_id is not null or u.principal_kind='human'))`;
}
function liveInvitation(row: Invitation) {
	return sql<boolean>`exists(select 1 from ${invitations} i where i.id=${row.id}::uuid and i.revision=${row.revision} and i.state='pending' and i.expires_at>clock_timestamp())
 and (${liveRecipient(row.recipientSubjectId)}) and (${row.contactId ? sql`exists(select 1 from ${contacts} c where c.id=${row.contactId}::uuid and c.scope_id=${row.scopeId}::uuid and c.subject_id=${row.recipientSubjectId}::uuid and c.revoked_at is null and c.expires_at>clock_timestamp())` : sql`true`})`;
}
async function inviter(tx: DatabaseTransaction, row: Invitation) {
	const evidence = row.authority;
	if (!evidence) throw new AccessUnavailable();
	const context = new PrincipalRequestContext(
		evidence.principalId,
		evidence.selection,
		evidence.proof,
	);
	const scope = await organizationEnrollmentScope(tx, row.organizationEntityId, true);
	if (scope.scopeId !== row.scopeId || scope.revision !== row.organizationRevision)
		throw new AccessDenied();
	const manager = await organizationMembershipAuthority(
		tx,
		context,
		scope.scopeId,
		scope.admission,
		true,
		false,
	);
	if (
		manager.subjectId !== row.authoritySubjectId ||
		manager.principalId !== row.invitedByAuthUserId ||
		groupAuthoritySourceDigest(manager) !== evidence.sourceDigest
	)
		throw new AccessDenied();
	return manager;
}
/** Reevaluate one bounded private candidate; workers and readers preserve unavailable. @internal */
export async function organizationInvitationAvailability(
	tx: DatabaseTransaction,
	row: Invitation,
): Promise<"allow" | "deny" | "unavailable"> {
	try {
		const outcome = await eligible(tx, row.recipientSubjectId, "write");
		if (outcome !== "allow") return outcome;
		const scope = await organizationEnrollmentScope(tx, row.organizationEntityId, false);
		await requireAccessAdmission(tx, scope.admission);
		if (row.state === "pending") {
			const source = await inviter(tx, row);
			await requireAccessAdmission(tx, sql`(${source.admission}) and (${liveInvitation(row)})`);
		}
		return "allow";
	} catch (error) {
		try {
			rethrowAccessFailure(error);
		} catch (failure) {
			if (failure instanceof AccessDenied) return "deny";
			if (failure instanceof AccessUnavailable || failure instanceof AccessRecordUnavailable)
				return "unavailable";
			throw failure;
		}
	}
}
async function invitationPage(tx: DatabaseTransaction, rows: Invitation[]) {
	const now = await clock(tx),
		items = [];
	for (const row of rows.slice(0, 50)) {
		const subject = await resolveAccessSubject(tx, row.recipientSubjectId);
		if (!subject) throw new AccessUnavailable();
		const head = await readAccessMembership(tx, {
			scopeId: row.scopeId,
			subjectId: row.recipientSubjectId,
		});
		const [names] = (
			await tx.execute<{ organization_name: string | null; recipient_name: string | null }>(
				sql`select ${publicEntityName(row.organizationEntityId)} as organization_name,${subject.kind === "entity" ? publicEntityName(subject.id) : sql`null::text`} as recipient_name`,
			)
		).rows;
		items.push({
			organizationName: names?.organization_name ?? null,
			recipientName: names?.recipient_name ?? null,
			id: row.id,
			organizationEntityId: row.organizationEntityId,
			kind: subject.kind,
			entityId: subject.kind === "entity" ? subject.id : null,
			state: row.state === "pending" && row.expiresAt <= now ? ("expired" as const) : row.state,
			revision: row.revision,
			availability: await organizationInvitationAvailability(tx, row),
			membershipVersion: head?.version ?? 0,
			expiresAt: row.expiresAt.toISOString(),
			createdAt: row.createdAt.toISOString(),
			resolvedAt: row.resolvedAt?.toISOString() ?? null,
		});
	}
	return { items, nextCursor: rows.length > 50 ? (items.at(-1)?.id ?? null) : null };
}
/** A recipient explicitly enables scope-specific private contact without sending any message. @alpha */
export async function createOrganizationEnrollmentContact(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	organizationEntityId: string,
) {
	const scope = await organizationEnrollmentScope(tx, organizationEntityId, false);
	const actor = await enrollmentSubjectAuthority(tx, context, true);
	if (context.selection.mode !== "direct") throw new AccessDenied();
	const now = await clock(tx),
		secret = randomBytes(32).toString("base64url"),
		expiresAt = new Date(now.getTime() + 7 * Day);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`org-enrollment-contact:${actor.subjectId}`},0))`,
	);
	const rows = await tx
		.select({ id: contacts.id })
		.from(contacts)
		.where(and(eq(contacts.subjectId, actor.subjectId), isNull(contacts.revokedAt)))
		.limit(65);
	if (rows.length >= 64) throw new OrganizationMembershipCapacityExceeded();
	await requireAccessAdmission(tx, sql`(${actor.admission})`);
	const [row] = await tx
		.insert(contacts)
		.values({
			scopeId: scope.scopeId,
			subjectId: actor.subjectId,
			secretDigest: digestSecret(secret),
			expiresAt,
			createdAt: now,
		})
		.returning();
	if (!row) throw new Error("Contact insertion returned no row");
	await requireAccessAdmission(tx, sql`(${actor.admission})`);
	return { id: row.id, version: row.version, contact: secret, expiresAt: expiresAt.toISOString() };
}
/** Revocation cancels consent for unresolved private invitations; accepted membership is independent. @alpha */
export async function revokeOrganizationEnrollmentContact(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	id: string,
) {
	const actor = await enrollmentSubjectAuthority(tx, context, true);
	const [row] = await tx
		.select()
		.from(contacts)
		.where(and(eq(contacts.id, id), eq(contacts.subjectId, actor.subjectId)))
		.for("update");
	if (!row) throw new OrganizationMembershipNotFound();
	if (!row.revokedAt)
		await tx
			.update(contacts)
			.set({ revokedAt: await clock(tx), version: 2 })
			.where(eq(contacts.id, id));
	await requireAccessAdmission(tx, actor.admission);
	return { id, version: 2 as const, revoked: true };
}
/** Exchange a recipient-provided contact for a short-lived private selector under current Org management. @alpha */
export async function resolveOrganizationEnrollmentContact(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	organizationEntityId: string,
	contact: string,
) {
	const scope = await organizationEnrollmentScope(tx, organizationEntityId, true);
	const manager = await organizationMembershipAuthority(
		tx,
		context,
		scope.scopeId,
		scope.admission,
		true,
	);
	const [row] = await tx
		.select()
		.from(contacts)
		.where(
			and(eq(contacts.secretDigest, digestSecret(contact)), eq(contacts.scopeId, scope.scopeId)),
		)
		.for("share");
	const now = await clock(tx);
	if (!row || row.revokedAt || row.expiresAt <= now) throw new AccessRecordUnavailable();
	await requireEligible(tx, row.subjectId, "write");
	await requireAccessAdmission(
		tx,
		sql`(${manager.admission}) and (${liveRecipient(row.subjectId)})`,
	);
	return {
		recipient: {
			kind: "principal" as const,
			selector: membershipRecipients.mint(
				row.subjectId,
				membershipRecipientContext(context, scope.scopeId),
				now.getTime(),
			),
		},
		expiresAt: new Date(now.getTime() + 300000).toISOString(),
	};
}
/** Invite one eligible Entity or explicitly disclosed private principal. Pending never creates shared membership. @alpha */
export async function inviteOrganizationMember(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	organizationEntityId: string,
	input: z.input<typeof CreateMembershipInvitationSchema>,
) {
	const value = CreateMembershipInvitationSchema.parse(input),
		scope = await organizationEnrollmentScope(tx, organizationEntityId, true);
	await lockOrganizationEnrollment(tx, scope.scopeId);
	const manager = await organizationMembershipAuthority(
		tx,
		context,
		scope.scopeId,
		scope.admission,
		true,
	);
	const target = await recipient(tx, context, scope.scopeId, value.recipient);
	const request = {
		operation: "invite",
		organizationEntityId,
		recipientSubjectId: target.subjectId,
		expiresAt: value.expiresAt ?? null,
	};
	const prior = await receipt(
		tx,
		scope.scopeId,
		value.operationId,
		manager.principalId,
		manager.subjectId,
		request,
	);
	if (prior) {
		await requireAccessAdmission(tx, manager.admission);
		return prior;
	}
	await tx.execute(
		sql`select public.organization_enrollment_lock_admission(${scope.scopeId}::uuid,${target.subjectId}::uuid)`,
	);
	await requireEligible(tx, target.subjectId, "write");
	const now = await clock(tx),
		expiresAt = value.expiresAt ? new Date(value.expiresAt) : new Date(now.getTime() + 7 * Day);
	if (expiresAt <= now || expiresAt.getTime() > now.getTime() + 30 * Day)
		throw new OrganizationMembershipConflict("Invitation expiry must be within thirty days");
	let contactId: string | null = null;
	if (target.subject.kind === "principal") {
		// Contact count per subject is a native bound, so this lookup never scans invitation history.
		const candidates = await tx
			.select()
			.from(contacts)
			.where(
				and(
					eq(contacts.subjectId, target.subjectId),
					eq(contacts.scopeId, scope.scopeId),
					isNull(contacts.revokedAt),
					gt(contacts.expiresAt, now),
				),
			)
			.limit(65)
			.for("share");
		if (candidates.length > 64) throw new AccessUnavailable();
		const contact = candidates[0];
		if (!contact) throw new AccessDenied();
		contactId = contact.id;
	}
	const head = await readAccessMembership(tx, {
		scopeId: scope.scopeId,
		subjectId: target.subjectId,
	});
	if (head?.activeGeneration !== null && head)
		throw new OrganizationMembershipConflict("Membership is already active");
	// Native pending indexes and locks bound both sets to 1,000, including expired slots.
	for (const condition of [
		eq(invitations.scopeId, scope.scopeId),
		eq(invitations.recipientSubjectId, target.subjectId),
	]) {
		await tx
			.update(invitations)
			.set({
				state: "expired",
				authority: null,
				revision: sql`${invitations.revision}+1`,
				resolvedAt: now,
			})
			.where(
				and(condition, eq(invitations.state, "pending"), sql`${invitations.expiresAt}<=${now}`),
			);
		const pending = await tx
			.select({ id: invitations.id })
			.from(invitations)
			.where(and(condition, eq(invitations.state, "pending")))
			.limit(1000);
		if (pending.length >= 1000) throw new OrganizationMembershipCapacityExceeded();
	}
	const [existingPending] = await tx.select({ id: invitations.id }).from(invitations)
  .where(and(eq(invitations.scopeId,scope.scopeId),eq(invitations.recipientSubjectId,target.subjectId),eq(invitations.state,"pending"))).limit(1);
 if (existingPending) throw new OrganizationMembershipConflict("A pending invitation already exists for this recipient");
	await requireAccessAdmission(
		tx,
		sql`(${manager.admission}) and (${liveRecipient(target.subjectId)})`,
	);
	const [row] = await tx
		.insert(invitations)
		.values({
			organizationEntityId,
			scopeId: scope.scopeId,
			organizationRevision: scope.revision,
			recipientSubjectId: target.subjectId,
			contactId,
			invitedByAuthUserId: manager.principalId,
			authoritySubjectId: manager.subjectId,
			authority: {
				principalId: context.principalId,
				selection: context.selection,
				proof: context.credentialProof(),
				sourceDigest: groupAuthoritySourceDigest(manager),
			},
			expiresAt,
			createdAt: now,
		})
		.returning();
	if (!row) throw new Error("Invitation insertion returned no row");
	const result = await record(
		tx,
		scope.scopeId,
		value.operationId,
		manager.principalId,
		manager.subjectId,
		target.subjectId,
		request,
		{ invitationId: row.id, revision: row.revision, state: row.state },
	);
	await requireAccessAdmission(tx, sql`(${manager.admission}) and (${liveInvitation(row)})`);
	return result;
}
async function invitationById(tx: DatabaseTransaction, id: string) {
	const [row] = await tx
		.select()
		.from(invitations)
		.where(eq(invitations.id, z.uuid().parse(id)));
	if (!row) throw new OrganizationMembershipNotFound();
	return row;
}
/** Exact acceptance atomically creates the shared admission consumed by Groups and all-members bindings. @alpha */
export async function acceptMembershipInvitation(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	id: string,
	input: z.input<typeof AcceptMembershipInvitationSchema>,
) {
	const value = AcceptMembershipInvitationSchema.parse(input),
		hint = await invitationById(tx, id);
	await lockOrganizationEnrollment(tx, hint.scopeId, hint.recipientSubjectId);
	const actor = await enrollmentSubjectAuthority(tx, context, true);
	if (actor.subjectId !== hint.recipientSubjectId) throw new OrganizationMembershipNotFound();
	const request = { operation: "accept", id, ...value };
	const prior = await receipt(
		tx,
		hint.scopeId,
		value.operationId,
		actor.principalId,
		actor.subjectId,
		request,
	);
	if (prior) {
		await requireAccessAdmission(tx, actor.admission);
		return prior;
	}
	const [row] = await tx.select().from(invitations).where(eq(invitations.id, id)).for("update");
	if (!row || row.state !== "pending" || row.revision !== value.expectedRevision)
		throw new OrganizationMembershipConflict();
	const source = await inviter(tx, row);
	await requireEligible(tx, row.recipientSubjectId, "write");
	if (row.contactId)
		await tx.select().from(contacts).where(eq(contacts.id, row.contactId)).for("share");
	const admission = sql<boolean>`(${actor.admission}) and (${source.admission}) and (${liveInvitation(row)})`;
	await requireAccessAdmission(tx, admission);
	const recovery = await prepareEnrollmentRecovery(tx, row.scopeId, row.recipientSubjectId);
	const member = await applyAccessMembershipCommand(
		tx,
		{
			scopeId: row.scopeId,
			subjectId: row.recipientSubjectId,
			expectedVersion: value.expectedMembershipVersion,
			operationId: value.operationId,
			operatorAuthUserId: actor.principalId,
			authoritySubjectId: actor.subjectId,
			operation: "admit",
		},
		admission,
	);
	const result: Result = {
		invitationId: id,
		revision: row.revision + 1,
		state: "accepted",
		membershipId: member.membershipId,
		version: member.version,
		activeGeneration: member.activeGeneration,
		lastGeneration: member.lastGeneration,
	};
	await tx
		.update(invitations)
		.set({
			state: "accepted",
			authority: null,
			revision: row.revision + 1,
			membershipId: member.membershipId,
			generation: member.activeGeneration,
			resolvedAt: await clock(tx),
		})
		.where(eq(invitations.id, id));
	await record(
		tx,
		row.scopeId,
		value.operationId,
		actor.principalId,
		actor.subjectId,
		row.recipientSubjectId,
		request,
		result,
	);
	await recovery(tx);
	await requireAccessAdmission(
		tx,
		sql`(${actor.admission}) and (${source.admission}) and (${liveRecipient(row.recipientSubjectId)}) and clock_timestamp()<${row.expiresAt}::timestamptz`,
	);
	return result;
}
async function resolveInvitation(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	id: string,
	input: z.input<typeof MembershipExpectedRevisionSchema>,
	organizationEntityId?: string,
) {
	const value = MembershipExpectedRevisionSchema.parse(input),
		hint = await invitationById(tx, id);
	await lockOrganizationEnrollment(tx, hint.scopeId);
	const scope = await organizationEnrollmentScope(tx, hint.organizationEntityId, true);
	const actor = organizationEntityId
		? await organizationMembershipAuthority(tx, context, scope.scopeId, scope.admission, true)
		: await enrollmentSubjectAuthority(tx, context, true);
	if (
		organizationEntityId
			? hint.organizationEntityId !== organizationEntityId
			: hint.recipientSubjectId !== actor.subjectId
	)
		throw new OrganizationMembershipNotFound();
	const state = organizationEntityId ? ("revoked" as const) : ("declined" as const),
		request = { operation: state, id, ...value };
	const prior = await receipt(
		tx,
		hint.scopeId,
		value.operationId,
		actor.principalId,
		actor.subjectId,
		request,
	);
	if (prior) {
		await requireAccessAdmission(tx, actor.admission);
		return prior;
	}
	const [row] = await tx.select().from(invitations).where(eq(invitations.id, id)).for("update");
	if (!row || row.state !== "pending" || row.revision !== value.expectedRevision)
		throw new OrganizationMembershipConflict();
	const now = await clock(tx),
		resolvedState = row.expiresAt <= now ? ("expired" as const) : state;
	await tx
		.update(invitations)
		.set({ state: resolvedState, authority: null, revision: row.revision + 1, resolvedAt: now })
		.where(eq(invitations.id, id));
	const result = await record(
		tx,
		row.scopeId,
		value.operationId,
		actor.principalId,
		actor.subjectId,
		row.recipientSubjectId,
		request,
		{ invitationId: id, state: resolvedState, revision: row.revision + 1 },
	);
	await requireAccessAdmission(tx, sql`(${actor.admission}) and (${scope.admission})`);
	return result;
}
/** Decline is a recipient-subject action, preserving the invitation's terminal receipt. @alpha */
export async function declineMembershipInvitation(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	id: string,
	input: z.input<typeof MembershipExpectedRevisionSchema>,
) {
	return resolveInvitation(tx, context, id, input);
}
/** Current Org managers can revoke a pending invitation; no delivery is implied. @alpha */
export async function cancelMembershipInvitation(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	organizationEntityId: string,
	id: string,
	input: z.input<typeof MembershipExpectedRevisionSchema>,
) {
	return resolveInvitation(tx, context, id, input, organizationEntityId);
}
async function depart(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	organizationEntityId: string,
	input: z.input<typeof MembershipDepartureSchema>,
	targetInput?: z.input<typeof MembershipRecipientSchema>,
) {
	const value = MembershipDepartureSchema.parse(input),
		scope = await organizationEnrollmentScope(tx, organizationEntityId, true);
	await lockOrganizationEnrollment(tx, scope.scopeId);
	const actor = targetInput
		? await organizationMembershipAuthority(tx, context, scope.scopeId, scope.admission, true)
		: await enrollmentSubjectAuthority(tx, context, true);
	const subjectId = targetInput
		? (await recipient(tx, context, scope.scopeId, targetInput)).subjectId
		: actor.subjectId;
	await tx.execute(
		sql`select public.lock_access_membership_key(${scope.scopeId}::uuid,${subjectId}::uuid,true)`,
	);
	const credential = await readFirstPartyCredentialAuthority(tx, {
		proof: context.credentialProof(),
		selection: context.selection,
		apiPermission: "access:manage",
		requireFreshSession: true,
		requireVerifiedEmail: true,
	});
	const actorSubjectId = await allocateAccessSubject(tx, {
		kind: "principal",
		id: context.principalId,
	});
	await requireEligible(tx, actorSubjectId, "write");
	await requireEligible(tx, actor.subjectId, "write");
	const operation = targetInput ? ("remove" as const) : ("leave" as const),
		request = { operation, organizationEntityId, subjectId, ...value };
	const prior = await receipt(
		tx,
		scope.scopeId,
		value.operationId,
		actor.principalId,
		actor.subjectId,
		request,
	);
	if (prior) {
		await requireAccessAdmission(tx, actor.admission);
		return prior;
	}
	const recovery = await prepareEnrollmentRecovery(tx, scope.scopeId, subjectId);
	const result = await applyAccessMembershipCommand(
		tx,
		{
			scopeId: scope.scopeId,
			subjectId,
			expectedVersion: value.expectedMembershipVersion,
			operationId: value.operationId,
			operatorAuthUserId: actor.principalId,
			authoritySubjectId: actor.subjectId,
			operation,
		},
		sql`(${actor.admission}) and (${scope.admission})`,
	);
	const saved = await record(
		tx,
		scope.scopeId,
		value.operationId,
		actor.principalId,
		actor.subjectId,
		subjectId,
		request,
		{
			membershipId: result.membershipId,
			version: result.version,
			lastGeneration: result.lastGeneration,
			activeGeneration: result.activeGeneration,
		},
	);
	await recovery(tx);
	// Departure can remove the operator's own management source; credential and scope still must be current.
	await requireAccessAdmission(
		tx,
		sql`(${scope.admission}) and (${credential.admission})
 and public.access_subject_is_eligible(${actorSubjectId}::uuid,'write') and public.access_subject_is_eligible(${actor.subjectId}::uuid,'write')`,
	);
	return saved;
}
/** End only this subject's active admission; retained Group selections cannot follow rejoin. @alpha */
export async function leaveOrganization(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	organizationEntityId: string,
	input: z.input<typeof MembershipDepartureSchema>,
) {
	return depart(tx, context, organizationEntityId, input);
}
/** Remove an exact currently disclosed subject under native Org management. @alpha */
export async function removeOrganizationMember(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	organizationEntityId: string,
	input: z.input<typeof RemoveMembershipSchema>,
) {
	const { recipient: target, ...value } = RemoveMembershipSchema.parse(input);
	return depart(tx, context, organizationEntityId, value, target);
}
/** Indexed candidate page; unavailable/denied entries stay visible to the currently authorized manager. @alpha */
export async function listOrganizationMembershipInvitations(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	organizationEntityId: string,
	input: z.input<typeof MembershipPageQuerySchema>,
) {
	const { afterId } = MembershipPageQuerySchema.parse(input),
		scope = await organizationEnrollmentScope(tx, organizationEntityId, false);
	const manager = await organizationMembershipAuthority(
		tx,
		context,
		scope.scopeId,
		scope.admission,
		false,
	);
	const rows = await tx
		.select()
		.from(invitations)
		.where(
			and(
				eq(invitations.scopeId, scope.scopeId),
				afterId ? gt(invitations.id, z.uuid().parse(afterId)) : undefined,
			),
		)
		.orderBy(invitations.id)
		.limit(51);
	const result = await invitationPage(tx, rows);
	await requireAccessAdmission(tx, manager.admission);
	return result;
}
/** Inbox includes terminal history and preserves pending eligibility failures without converting them into absence. @alpha */
export async function listOwnMembershipInvitations(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	input: z.input<typeof MembershipPageQuerySchema>,
) {
	const { afterId } = MembershipPageQuerySchema.parse(input),
		actor = await enrollmentSubjectAuthority(tx, context, false);
	const rows = await tx
		.select()
		.from(invitations)
		.where(
			and(
				eq(invitations.recipientSubjectId, actor.subjectId),
				afterId ? gt(invitations.id, z.uuid().parse(afterId)) : undefined,
			),
		)
		.orderBy(invitations.id)
		.limit(51);
	const result = await invitationPage(tx, rows);
	await requireAccessAdmission(tx, actor.admission);
	return result;
}
async function memberPage(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	rows: { member: typeof accessMembership.$inferSelect; organizationEntityId: string }[],
) {
	const now = await clock(tx),
		items = [];
	for (const { member, organizationEntityId } of rows.slice(0, 50)) {
		const subject = await resolveAccessSubject(tx, member.subjectId);
		if (!subject) throw new AccessUnavailable();
		let availability: "allow" | "deny" | "unavailable";
		try {
			availability = await eligible(tx, member.subjectId, "read");
			const scope = await organizationEnrollmentScope(tx, organizationEntityId, false);
			await requireAccessAdmission(tx, scope.admission);
		} catch (error) {
			try {
				rethrowAccessFailure(error);
			} catch (failure) {
				if (failure instanceof AccessDenied) availability = "deny";
				else if (failure instanceof AccessUnavailable || failure instanceof AccessRecordUnavailable)
					availability = "unavailable";
				else throw failure;
			}
		}
		const [names] = (
			await tx.execute<{ organization_name: string | null; member_name: string | null }>(
				sql`select ${publicEntityName(organizationEntityId)} as organization_name,${subject.kind === "entity" ? publicEntityName(subject.id) : sql`null::text`} as member_name`,
			)
		).rows;
		items.push({
			organizationName: names?.organization_name ?? null,
			memberName: names?.member_name ?? null,
			membershipId: member.id,
			organizationEntityId,
			recipient: presentRecipient(context, member.scopeId, member.subjectId, subject, now),
			version: member.version,
			activeGeneration: member.activeGeneration,
			lastGeneration: member.lastGeneration,
			availability,
		});
	}
	return {
		items,
		nextCursor:
			rows.length > 50
				? membershipRecipients.mint(
						rows[49]!.member.subjectId,
						membershipRecipientContext(context, rows[49]!.member.scopeId),
						now.getTime(),
					)
				: null,
	};
}
/** Roster is the shared scope/subject head, including departed identities and exact generations. @alpha */
export async function listOrganizationMembers(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	organizationEntityId: string,
	input: z.input<typeof MembershipPageQuerySchema>,
) {
	const { afterId } = MembershipPageQuerySchema.parse(input),
		scope = await organizationEnrollmentScope(tx, organizationEntityId, false);
	const manager = await organizationMembershipAuthority(
		tx,
		context,
		scope.scopeId,
		scope.admission,
		false,
	);
	const afterSubject = afterId
		? membershipRecipients.resolve(
				afterId,
				membershipRecipientContext(context, scope.scopeId),
				(await clock(tx)).getTime(),
			)
		: undefined;
	const rows = await tx
		.select()
		.from(accessMembership)
		.where(
			and(
				eq(accessMembership.scopeId, scope.scopeId),
				afterSubject ? gt(accessMembership.subjectId, afterSubject) : undefined,
			),
		)
		.orderBy(accessMembership.subjectId)
		.limit(51);
	const result = await memberPage(
		tx,
		context,
		rows.map((member) => ({ member, organizationEntityId })),
	);
	await requireAccessAdmission(tx, manager.admission);
	return result;
}
/** Indexed subject/scope candidates are selected before resolving their Org owner. @alpha */
export async function listOwnOrganizationMemberships(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	input: z.input<typeof MembershipPageQuerySchema>,
) {
	const { afterId } = MembershipPageQuerySchema.parse(input),
		actor = await enrollmentSubjectAuthority(tx, context, false);
	const candidates = await tx
		.select()
		.from(accessMembership)
		.where(
			and(
				eq(accessMembership.subjectId, actor.subjectId),
				afterId ? gt(accessMembership.scopeId, z.uuid().parse(afterId)) : undefined,
			),
		)
		.orderBy(accessMembership.scopeId)
		.limit(51);
	const page = candidates.slice(0, 50),
		rows = [];
	for (const member of page) {
		const [owner] = (
			await tx.execute<{ id: string }>(
				sql`select r.target_entity_id as id from public.access_scope s join public.reference_value r on r.id=s.unit_ref join public.entity_identity e on e.id=r.target_entity_id where s.id=${member.scopeId}::uuid and e.shape='organization'`,
			)
		).rows;
		if (owner) rows.push({ member, organizationEntityId: owner.id });
	}
	const result = await memberPage(tx, context, rows);
	await requireAccessAdmission(tx, actor.admission);
	return { ...result, nextCursor: candidates.length > 50 ? (page.at(-1)?.scopeId ?? null) : null };
}
/** Exact subject history paginates immutable shared receipts without exposing private operators. @alpha */
export async function listOrganizationMembershipHistory(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	organizationEntityId: string,
	target: z.input<typeof MembershipRecipientSchema>,
	afterVersion?: number,
) {
	const scope = await organizationEnrollmentScope(tx, organizationEntityId, false),
		manager = await organizationMembershipAuthority(
			tx,
			context,
			scope.scopeId,
			scope.admission,
			false,
		);
	const { subjectId } = await recipient(tx, context, scope.scopeId, target),
		head = await readAccessMembership(tx, { scopeId: scope.scopeId, subjectId });
	if (!head) throw new OrganizationMembershipNotFound();
	const rows = await tx
		.select()
		.from(accessMembershipEvent)
		.where(
			and(
				eq(accessMembershipEvent.membershipId, head.id),
				afterVersion === undefined ? undefined : gt(accessMembershipEvent.version, afterVersion),
			),
		)
		.orderBy(accessMembershipEvent.version)
		.limit(51);
	await requireAccessAdmission(tx, manager.admission);
	const items = rows
		.slice(0, 50)
		.map((row) => ({
			version: row.version,
			operation: row.operation,
			lastGeneration: row.lastGeneration,
			activeGeneration: row.activeGeneration,
			createdAt: row.createdAt.toISOString(),
		}));
	return { items, nextCursor: rows.length > 50 ? (items.at(-1)?.version ?? null) : null };
}
/** Bounded sent-invitation invalidation; accepted institutional admissions are untouched. @internal */
export async function invalidateErasedMembershipInvitations(
	tx: DatabaseTransaction,
	authUserId: string,
) {
	const [account] = await tx.select().from(users).where(eq(users.id, authUserId)).for("share");
	if (!account?.erasedAt) throw new AccessDenied();
	const rows = await tx
		.select()
		.from(invitations)
		.where(and(eq(invitations.invitedByAuthUserId, authUserId), eq(invitations.state, "pending")))
		.orderBy(invitations.id)
		.limit(100)
		.for("update", { skipLocked: true });
	if (rows.length)
		await tx
			.update(invitations)
			.set({
				state: "invalidated",
				authority: null,
				revision: sql`${invitations.revision}+1`,
				resolvedAt: await clock(tx),
			})
			.where(
				inArray(
					invitations.id,
					rows.map((row) => row.id),
				),
			);
	const [remaining] = await tx
		.select({ id: invitations.id })
		.from(invitations)
		.where(and(eq(invitations.invitedByAuthUserId, authUserId), eq(invitations.state, "pending")))
		.limit(1);
	return { deleted: rows.length, empty: !remaining };
}
