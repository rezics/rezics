import { and, eq, gt, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { users } from "../database/schema/auth";
import { entityIdentity } from "../database/schema/catalog-identity";
import {
	authEntity,
	entityParticipation,
	participationGrant,
} from "../database/schema/participation";
import {
	organizationMembership,
	organizationMembershipInvitation,
} from "../database/schema/organization-membership";
import { ensureAccountAuthenticationAllowed } from "../auth/account-state";
import { requireParticipation, ParticipationDenied, type ParticipationAuthority } from "./policy";
import { publicEntityName } from "./presentation";
import {
	CreateMembershipInvitationSchema,
	MembershipExpectedRevisionSchema,
	MembershipPageQuerySchema,
	OrganizationMembershipCapacityExceeded,
	OrganizationMembershipConflict,
	OrganizationMembershipNotFound,
} from "./membership-contracts";

const MaxPendingInvitations = 1000;
const OneDay = 86_400_000;

async function admitAccount(tx: DatabaseTransaction, authority: ParticipationAuthority) {
	if (authority.principal.kind !== "auth")
		throw new ParticipationDenied("Organization membership requires a human account");
	const authUserId = authority.principal.authUserId;
	const [account] = await tx
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.id, authUserId), eq(users.principalKind, "human"), isNull(users.erasedAt)))
		.limit(1)
		.for("share");
	if (!account) throw new ParticipationDenied("Account is unavailable");
	await ensureAccountAuthenticationAllowed(authUserId, tx);
	const [binding] = await tx
		.select()
		.from(authEntity)
		.where(
			and(
				eq(authEntity.authUserId, authUserId),
				eq(authEntity.state, "active"),
				eq(authEntity.revision, authority.authorizationRevision),
			),
		)
		.limit(1)
		.for("share");
	if (!binding) throw new ParticipationDenied("Account self identity is unavailable");
	return { authUserId, selfEntityId: binding.entityId };
}

async function requireManager(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	organizationEntityId: string,
) {
	z.uuid().parse(organizationEntityId);
	if (authority.principal.kind !== "auth" || !authority.grant)
		throw new ParticipationDenied(
			"Membership management requires an explicit human organization grant",
		);
	await requireParticipation(tx, authority, "entity.membership", {
		owner: "entity",
		id: organizationEntityId,
	});
	const [organization] = await tx
		.select({ revision: entityParticipation.revision })
		.from(entityParticipation)
		.innerJoin(entityIdentity, eq(entityIdentity.id, entityParticipation.entityId))
		.where(
			and(
				eq(entityParticipation.entityId, organizationEntityId),
				eq(entityIdentity.shape, "organization"),
				isNull(entityIdentity.deletedAt),
				eq(entityParticipation.state, "active"),
			),
		)
		.limit(1)
		.for("share");
	if (!organization) throw new ParticipationDenied("Membership requires a controlled organization");
	return {
		organizationRevision: organization.revision,
		grant: authority.grant,
		authUserId: authority.principal.authUserId,
	};
}

/** Current source eligibility is computed from the persisted exact invitation authority, not caller input. */
function invalidInvitationAuthority(table: typeof organizationMembershipInvitation) {
	return sql`not exists (
		select 1 from ${participationGrant} g
		join ${users} u on u.id = g.auth_user_id
		join ${authEntity} b on b.auth_user_id = u.id
		join ${entityParticipation} p on p.entity_id = g.acting_entity_id
		join ${entityIdentity} e on e.id = p.entity_id
		where g.id = ${table.authorizationGrantId} and g.revision = ${table.authorizationGrantRevision}
		and g.auth_user_id = ${table.invitedByAuthUserId} and g.capability = 'entity.membership'
		and g.acting_entity_id = ${table.organizationEntityId} and g.entity_id = ${table.organizationEntityId}
		and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
		and u.erased_at is null and b.state = 'active' and b.revision = ${table.inviterAuthorizationRevision}
		and p.state = 'active' and p.revision = ${table.organizationRevision}
		and e.shape = 'organization' and e.deleted_at is null
	)`;
}

async function readInvitationRows(tx: DatabaseTransaction, condition: SQL, limit = 101) {
	return tx
		.select({
			invitation: organizationMembershipInvitation,
			organizationName: publicEntityName(organizationMembershipInvitation.organizationEntityId),
			recipientName: publicEntityName(organizationMembershipInvitation.recipientEntityId),
			invalidAuthority: invalidInvitationAuthority(organizationMembershipInvitation).mapWith(
				Boolean,
			),
		})
		.from(organizationMembershipInvitation)
		.where(condition)
		.orderBy(organizationMembershipInvitation.id)
		.limit(limit);
}

function presentInvitation(row: Awaited<ReturnType<typeof readInvitationRows>>[number]) {
	const value = row.invitation;
	const state =
		value.state === "pending" && value.expiresAt <= new Date()
			? ("expired" as const)
			: value.state === "pending" && row.invalidAuthority
				? ("invalidated" as const)
				: value.state;
	return {
		id: value.id,
		organizationEntityId: value.organizationEntityId,
		organizationName: row.organizationName,
		recipientEntityId: value.recipientEntityId,
		recipientName: row.recipientName,
		state,
		revision: value.revision,
		expiresAt: value.expiresAt.toISOString(),
		createdAt: value.createdAt.toISOString(),
		resolvedAt: value.resolvedAt?.toISOString() ?? null,
	};
}

async function invitationById(tx: DatabaseTransaction, id: string) {
	const [row] = await readInvitationRows(tx, eq(organizationMembershipInvitation.id, id), 1);
	if (!row) throw new OrganizationMembershipNotFound();
	return presentInvitation(row);
}

function invitationPage(rows: Awaited<ReturnType<typeof readInvitationRows>>) {
	const items = rows.slice(0, 100).map(presentInvitation);
	return { items, nextCursor: rows.length > 100 ? (items.at(-1)?.id ?? null) : null };
}

/** Only a selected membership manager can inspect the organization's private roster/invitations. */
export async function listOrganizationMembershipInvitations(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	organizationEntityId: string,
	input: z.input<typeof MembershipPageQuerySchema>,
) {
	await requireManager(tx, authority, organizationEntityId);
	const { afterId } = MembershipPageQuerySchema.parse(input);
	return invitationPage(
		await readInvitationRows(
			tx,
			and(
				eq(organizationMembershipInvitation.organizationEntityId, organizationEntityId),
				afterId ? gt(organizationMembershipInvitation.id, afterId) : undefined,
			)!,
		),
	);
}

/** A selected organization never substitutes for the actual account that owns this inbox. */
export async function listOwnMembershipInvitations(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	input: z.input<typeof MembershipPageQuerySchema>,
) {
	const { authUserId } = await admitAccount(tx, authority);
	const { afterId } = MembershipPageQuerySchema.parse(input);
	return invitationPage(
		await readInvitationRows(
			tx,
			and(
				eq(organizationMembershipInvitation.recipientAuthUserId, authUserId),
				eq(organizationMembershipInvitation.state, "pending"),
				afterId ? gt(organizationMembershipInvitation.id, afterId) : undefined,
			)!,
		),
	);
}

export async function inviteOrganizationMember(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	organizationEntityId: string,
	input: z.input<typeof CreateMembershipInvitationSchema>,
) {
	const manager = await requireManager(tx, authority, organizationEntityId);
	const value = CreateMembershipInvitationSchema.parse(input);
	const [recipient] = await tx
		.select({ authUserId: authEntity.authUserId })
		.from(authEntity)
		.innerJoin(users, eq(users.id, authEntity.authUserId))
		.where(
			and(
				eq(authEntity.entityId, value.recipientEntityId),
				eq(authEntity.state, "active"),
				isNull(users.erasedAt),
				eq(users.principalKind, "human"),
			),
		)
		.limit(1)
		.for("share");
	if (!recipient) throw new ParticipationDenied("Recipient has no active human account");
	const now = new Date();
	const expiresAt = value.expiresAt
		? new Date(value.expiresAt)
		: new Date(now.getTime() + 7 * OneDay);
	if (expiresAt <= now || expiresAt.getTime() > now.getTime() + 30 * OneDay)
		throw new OrganizationMembershipConflict("Invitation expiry must be within thirty days");
	await tx.execute(
		sql`select public.organization_membership_lock_admission(${organizationEntityId}::uuid, ${recipient.authUserId}::uuid)`,
	);
	// Both indexed pending sets have a database-enforced 1,000-row bound, even when entries have expired.
	await tx
		.update(organizationMembershipInvitation)
		.set({
			state: sql`case when ${organizationMembershipInvitation.expiresAt} <= ${now} then 'expired' else 'invalidated' end`,
			revision: sql`${organizationMembershipInvitation.revision} + 1`,
			resolvedAt: now,
			resolvedByAuthUserId: null,
			updatedAt: now,
		})
		.where(
			and(
				eq(organizationMembershipInvitation.state, "pending"),
				or(
					eq(organizationMembershipInvitation.organizationEntityId, organizationEntityId),
					eq(organizationMembershipInvitation.recipientAuthUserId, recipient.authUserId),
				),
				or(
					sql`${organizationMembershipInvitation.expiresAt} <= ${now}`,
					invalidInvitationAuthority(organizationMembershipInvitation),
				),
			),
		);
	const [existing] = await tx
		.select({ removedAt: organizationMembership.removedAt })
		.from(organizationMembership)
		.where(
			and(
				eq(organizationMembership.organizationEntityId, organizationEntityId),
				eq(organizationMembership.memberAuthUserId, recipient.authUserId),
			),
		)
		.limit(1);
	if (existing && existing.removedAt === null)
		throw new OrganizationMembershipConflict("This account is already a member");
	const [pending] = await tx
		.select({ id: organizationMembershipInvitation.id })
		.from(organizationMembershipInvitation)
		.where(
			and(
				eq(organizationMembershipInvitation.organizationEntityId, organizationEntityId),
				eq(organizationMembershipInvitation.recipientAuthUserId, recipient.authUserId),
				eq(organizationMembershipInvitation.state, "pending"),
			),
		)
		.limit(1);
	if (pending) return invitationById(tx, pending.id);
	for (const condition of [
		eq(organizationMembershipInvitation.organizationEntityId, organizationEntityId),
		eq(organizationMembershipInvitation.recipientAuthUserId, recipient.authUserId),
	]) {
		const rows = await tx
			.select({ id: organizationMembershipInvitation.id })
			.from(organizationMembershipInvitation)
			.where(and(condition, eq(organizationMembershipInvitation.state, "pending")))
			.limit(MaxPendingInvitations);
		if (rows.length >= MaxPendingInvitations) throw new OrganizationMembershipCapacityExceeded();
	}
	const [invitation] = await tx
		.insert(organizationMembershipInvitation)
		.values({
			organizationEntityId,
			organizationRevision: manager.organizationRevision,
			recipientAuthUserId: recipient.authUserId,
			recipientEntityId: value.recipientEntityId,
			invitedByAuthUserId: manager.authUserId,
			inviterAuthorizationRevision: authority.authorizationRevision,
			authorizationGrantId: manager.grant.id,
			authorizationGrantRevision: manager.grant.revision,
			expiresAt,
			createdAt: now,
			updatedAt: now,
		})
		.returning({ id: organizationMembershipInvitation.id });
	if (!invitation) throw new Error("Membership invitation insertion returned no row");
	return invitationById(tx, invitation.id);
}

async function lockRecipientInvitation(
	tx: DatabaseTransaction,
	authUserId: string,
	id: string,
	expectedRevision: number,
) {
	z.uuid().parse(id);
	MembershipExpectedRevisionSchema.parse({ expectedRevision });
	const [invitation] = await tx
		.select()
		.from(organizationMembershipInvitation)
		.where(
			and(
				eq(organizationMembershipInvitation.id, id),
				eq(organizationMembershipInvitation.recipientAuthUserId, authUserId),
			),
		)
		.limit(1)
		.for("update");
	if (!invitation) throw new OrganizationMembershipNotFound();
	if (invitation.state !== "pending" || invitation.revision !== expectedRevision)
		throw new OrganizationMembershipConflict();
	return invitation;
}

export async function acceptMembershipInvitation(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	id: string,
	expectedRevision: number,
) {
	const account = await admitAccount(tx, authority);
	z.uuid().parse(id);
	const [invitation] = await tx
		.select()
		.from(organizationMembershipInvitation)
		.where(
			and(
				eq(organizationMembershipInvitation.id, id),
				eq(organizationMembershipInvitation.recipientAuthUserId, account.authUserId),
			),
		)
		.limit(1);
	if (!invitation) throw new OrganizationMembershipNotFound();
	if (invitation.recipientEntityId !== account.selfEntityId || invitation.expiresAt <= new Date())
		throw new OrganizationMembershipConflict(
			"Invitation no longer addresses an eligible recipient",
		);
	const issuerAuthority: ParticipationAuthority = {
		principal: { kind: "auth", authUserId: invitation.invitedByAuthUserId },
		actingEntityId: invitation.organizationEntityId,
		authorizationRevision: invitation.inviterAuthorizationRevision,
		grant: { id: invitation.authorizationGrantId, revision: invitation.authorizationGrantRevision },
	};
	const manager = await requireManager(tx, issuerAuthority, invitation.organizationEntityId);
	if (manager.organizationRevision !== invitation.organizationRevision)
		throw new OrganizationMembershipConflict("Organization participation generation changed");
	await tx.execute(
		sql`select public.organization_membership_lock_admission(${invitation.organizationEntityId}::uuid, ${account.authUserId}::uuid)`,
	);
	await lockRecipientInvitation(tx, account.authUserId, id, expectedRevision);
	const [member] = await tx
		.select()
		.from(organizationMembership)
		.where(
			and(
				eq(organizationMembership.organizationEntityId, invitation.organizationEntityId),
				eq(organizationMembership.memberAuthUserId, account.authUserId),
			),
		)
		.limit(1)
		.for("update");
	if (member && member.removedAt === null)
		throw new OrganizationMembershipConflict("Membership is already active");
	const now = new Date();
	await tx
		.update(organizationMembershipInvitation)
		.set({
			state: "accepted",
			revision: invitation.revision + 1,
			resolvedAt: now,
			resolvedByAuthUserId: account.authUserId,
			updatedAt: now,
		})
		.where(eq(organizationMembershipInvitation.id, id));
	await tx
		.insert(organizationMembership)
		.values({
			organizationEntityId: invitation.organizationEntityId,
			memberAuthUserId: account.authUserId,
			memberEntityId: account.selfEntityId,
			acceptedInvitationId: id,
			joinedAt: now,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [
				organizationMembership.organizationEntityId,
				organizationMembership.memberAuthUserId,
			],
			set: {
				acceptedInvitationId: id,
				joinedAt: now,
				removedAt: null,
				removedByAuthUserId: null,
				revision: sql`${organizationMembership.revision} + 1`,
				updatedAt: now,
			},
		});
	return invitationById(tx, id);
}

export async function declineMembershipInvitation(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	id: string,
	expectedRevision: number,
) {
	const account = await admitAccount(tx, authority);
	const invitation = await lockRecipientInvitation(tx, account.authUserId, id, expectedRevision);
	const now = new Date();
	await tx
		.update(organizationMembershipInvitation)
		.set({
			state: "declined",
			revision: invitation.revision + 1,
			resolvedAt: now,
			resolvedByAuthUserId: account.authUserId,
			updatedAt: now,
		})
		.where(eq(organizationMembershipInvitation.id, id));
	return invitationById(tx, id);
}

export async function cancelMembershipInvitation(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	organizationEntityId: string,
	id: string,
	expectedRevision: number,
) {
	const manager = await requireManager(tx, authority, organizationEntityId);
	z.uuid().parse(id);
	MembershipExpectedRevisionSchema.parse({ expectedRevision });
	const [invitation] = await tx
		.select()
		.from(organizationMembershipInvitation)
		.where(
			and(
				eq(organizationMembershipInvitation.id, id),
				eq(organizationMembershipInvitation.organizationEntityId, organizationEntityId),
			),
		)
		.limit(1)
		.for("update");
	if (!invitation) throw new OrganizationMembershipNotFound();
	if (invitation.state !== "pending" || invitation.revision !== expectedRevision)
		throw new OrganizationMembershipConflict();
	const now = new Date();
	await tx
		.update(organizationMembershipInvitation)
		.set({
			state: "cancelled",
			revision: invitation.revision + 1,
			resolvedAt: now,
			resolvedByAuthUserId: manager.authUserId,
			updatedAt: now,
		})
		.where(eq(organizationMembershipInvitation.id, id));
	return invitationById(tx, id);
}

async function memberRows(tx: DatabaseTransaction, condition: SQL, own: boolean) {
	return tx
		.select({
			member: organizationMembership,
			organizationName: publicEntityName(organizationMembership.organizationEntityId),
			memberName: publicEntityName(organizationMembership.memberEntityId),
		})
		.from(organizationMembership)
		.where(condition)
		.orderBy(
			own ? organizationMembership.organizationEntityId : organizationMembership.memberEntityId,
		)
		.limit(101);
}
function presentMember(row: Awaited<ReturnType<typeof memberRows>>[number]) {
	return {
		organizationEntityId: row.member.organizationEntityId,
		organizationName: row.organizationName,
		memberEntityId: row.member.memberEntityId,
		memberName: row.memberName,
		revision: row.member.revision,
		joinedAt: row.member.joinedAt.toISOString(),
		removedAt: row.member.removedAt?.toISOString() ?? null,
	};
}
function memberPage(rows: Awaited<ReturnType<typeof memberRows>>, own: boolean) {
	const items = rows.slice(0, 100).map(presentMember);
	const last = items.at(-1);
	return {
		items,
		nextCursor:
			rows.length > 100 && last ? (own ? last.organizationEntityId : last.memberEntityId) : null,
	};
}

export async function listOrganizationMembers(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	organizationEntityId: string,
	input: z.input<typeof MembershipPageQuerySchema>,
) {
	await requireManager(tx, authority, organizationEntityId);
	const { afterId } = MembershipPageQuerySchema.parse(input);
	return memberPage(
		await memberRows(
			tx,
			and(
				eq(organizationMembership.organizationEntityId, organizationEntityId),
				isNull(organizationMembership.removedAt),
				afterId ? gt(organizationMembership.memberEntityId, afterId) : undefined,
			)!,
			false,
		),
		false,
	);
}

export async function listOwnOrganizationMemberships(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	input: z.input<typeof MembershipPageQuerySchema>,
) {
	const account = await admitAccount(tx, authority);
	const { afterId } = MembershipPageQuerySchema.parse(input);
	return memberPage(
		await memberRows(
			tx,
			and(
				eq(organizationMembership.memberAuthUserId, account.authUserId),
				isNull(organizationMembership.removedAt),
				afterId ? gt(organizationMembership.organizationEntityId, afterId) : undefined,
			)!,
			true,
		),
		true,
	);
}

async function removeMember(
	tx: DatabaseTransaction,
	organizationEntityId: string,
	memberEntityId: string,
	operatorAuthUserId: string,
	expectedRevision: number,
) {
	MembershipExpectedRevisionSchema.parse({ expectedRevision });
	const [member] = await tx
		.select()
		.from(organizationMembership)
		.where(
			and(
				eq(organizationMembership.organizationEntityId, organizationEntityId),
				eq(organizationMembership.memberEntityId, z.uuid().parse(memberEntityId)),
			),
		)
		.limit(1)
		.for("update");
	if (!member) throw new OrganizationMembershipNotFound();
	if (member.removedAt !== null || member.revision !== expectedRevision)
		throw new OrganizationMembershipConflict();
	await tx
		.update(organizationMembership)
		.set({
			removedAt: new Date(),
			removedByAuthUserId: operatorAuthUserId,
			revision: member.revision + 1,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(organizationMembership.organizationEntityId, organizationEntityId),
				eq(organizationMembership.memberAuthUserId, member.memberAuthUserId),
			),
		);
	const rows = await memberRows(
		tx,
		and(
			eq(organizationMembership.organizationEntityId, organizationEntityId),
			eq(organizationMembership.memberEntityId, memberEntityId),
		)!,
		false,
	);
	if (!rows[0]) throw new OrganizationMembershipNotFound();
	return presentMember(rows[0]);
}

export async function removeOrganizationMember(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	organizationEntityId: string,
	memberEntityId: string,
	expectedRevision: number,
) {
	const manager = await requireManager(tx, authority, organizationEntityId);
	return removeMember(
		tx,
		organizationEntityId,
		memberEntityId,
		manager.authUserId,
		expectedRevision,
	);
}
export async function leaveOrganization(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	organizationEntityId: string,
	expectedRevision: number,
) {
	const account = await admitAccount(tx, authority);
	z.uuid().parse(organizationEntityId);
	return removeMember(
		tx,
		organizationEntityId,
		account.selfEntityId,
		account.authUserId,
		expectedRevision,
	);
}

/** Erasure invalidates pending sent invitations without changing other recipients' accepted memberships. */
export async function invalidateErasedMembershipInvitations(
	tx: DatabaseTransaction,
	authUserId: string,
) {
	const [account] = await tx
		.select({ erasedAt: users.erasedAt })
		.from(users)
		.where(eq(users.id, authUserId))
		.limit(1)
		.for("share");
	if (!account?.erasedAt)
		throw new ParticipationDenied("Invitation erasure requires a closed account");
	const result = await tx.execute<{ count: number }>(sql`with batch as materialized (
		select id from ${organizationMembershipInvitation} where invited_by_auth_user_id = ${authUserId}::uuid and state = 'pending' limit 500 for update skip locked
	), invalidated as (update ${organizationMembershipInvitation} set state = 'invalidated', revision = revision + 1, resolved_at = clock_timestamp(), resolved_by_auth_user_id = null, updated_at = clock_timestamp()
		where id in (select id from batch) returning 1) select count(*)::integer as count from invalidated`);
	const deleted = result.rows[0]?.count ?? 0;
	if (deleted) return { deleted, empty: false };
	const [remaining] = await tx
		.select({ id: organizationMembershipInvitation.id })
		.from(organizationMembershipInvitation)
		.where(
			and(
				eq(organizationMembershipInvitation.invitedByAuthUserId, authUserId),
				eq(organizationMembershipInvitation.state, "pending"),
			),
		)
		.limit(1);
	return { deleted, empty: !remaining };
}
