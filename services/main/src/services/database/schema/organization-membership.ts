import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	primaryKey,
	text,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { users } from "./auth";
import { entityIdentity } from "./catalog-identity";
import { entityParticipation, participationGrantEvent } from "./participation";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";

export const OrganizationMembershipInvitationStateValues = [
	"pending",
	"accepted",
	"declined",
	"cancelled",
	"expired",
	"invalidated",
] as const;

/** Private operational invitation. Its exact original authority is retained independently of public catalog affiliations. */
export const organizationMembershipInvitation = pgTable(
	"organization_membership_invitation",
	{
		id: createUuidv7PrimaryKey(),
		organizationEntityId: uuid()
			.notNull()
			.references(() => entityParticipation.entityId, { onDelete: "restrict" }),
		organizationRevision: bigint({ mode: "number" }).notNull(),
		recipientAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		recipientEntityId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		invitedByAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		inviterAuthorizationRevision: bigint({ mode: "number" }).notNull(),
		authorizationGrantId: uuid().notNull(),
		authorizationGrantRevision: bigint({ mode: "number" }).notNull(),
		state: text()
			.$type<(typeof OrganizationMembershipInvitationStateValues)[number]>()
			.notNull()
			.default("pending"),
		revision: bigint({ mode: "number" }).notNull().default(1),
		expiresAt: createTimestampMsColumn().notNull(),
		resolvedAt: createTimestampMsColumn(),
		resolvedByAuthUserId: uuid().references(() => users.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("organization_membership_invitation_scope_key").on(
			table.id,
			table.organizationEntityId,
			table.recipientAuthUserId,
			table.recipientEntityId,
		),
		uniqueIndex("organization_membership_invitation_pending_pair_key")
			.on(table.organizationEntityId, table.recipientAuthUserId)
			.where(sql`${table.state} = 'pending'`),
		index("organization_membership_invitation_org_page_idx").on(
			table.organizationEntityId,
			table.id,
		),
		index("organization_membership_invitation_recipient_state_idx").on(
			table.recipientAuthUserId,
			table.state,
			table.id,
		),
		index("organization_membership_invitation_sender_state_idx").on(
			table.invitedByAuthUserId,
			table.state,
			table.id,
		),
		index("organization_membership_invitation_recipient_entity_idx").on(
			table.recipientEntityId,
			table.id,
		),
		index("organization_membership_invitation_grant_idx").on(
			table.authorizationGrantId,
			table.authorizationGrantRevision,
		),
		index("organization_membership_invitation_resolver_idx")
			.on(table.resolvedByAuthUserId, table.id)
			.where(sql`${table.resolvedByAuthUserId} is not null`),
		foreignKey({
			name: "organization_membership_invitation_grant_event_fk",
			columns: [table.authorizationGrantId, table.authorizationGrantRevision],
			foreignColumns: [participationGrantEvent.grantId, participationGrantEvent.revision],
		}).onDelete("restrict"),
		check(
			"organization_membership_invitation_state_check",
			sql`${table.state} in ('pending','accepted','declined','cancelled','expired','invalidated')`,
		),
		check(
			"organization_membership_invitation_revision_check",
			sql`${table.revision} between 1 and 9007199254740991 and ${table.organizationRevision} between 1 and 9007199254740991 and ${table.inviterAuthorizationRevision} between 1 and 9007199254740991 and ${table.authorizationGrantRevision} between 1 and 9007199254740991`,
		),
		check(
			"organization_membership_invitation_expiry_check",
			sql`${table.expiresAt} > ${table.createdAt} and ${table.expiresAt} <= ${table.createdAt} + interval '30 days'`,
		),
		check(
			"organization_membership_invitation_resolution_check",
			sql`(${table.state} = 'pending' and ${table.resolvedAt} is null and ${table.resolvedByAuthUserId} is null) or (${table.state} <> 'pending' and ${table.resolvedAt} is not null and ${table.resolvedAt} >= ${table.createdAt} and ((${table.state} in ('accepted','declined') and ${table.resolvedByAuthUserId} is not null and ${table.resolvedByAuthUserId} = ${table.recipientAuthUserId}) or (${table.state} = 'cancelled' and ${table.resolvedByAuthUserId} is not null) or (${table.state} in ('expired','invalidated') and ${table.resolvedByAuthUserId} is null)))`,
		),
	],
);

/** Accepted operational membership is not a publication, security or catalog-editing grant. */
export const organizationMembership = pgTable(
	"organization_membership",
	{
		organizationEntityId: uuid()
			.notNull()
			.references(() => entityParticipation.entityId, { onDelete: "restrict" }),
		memberAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		memberEntityId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		acceptedInvitationId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull().default(1),
		joinedAt: createTimestampMsColumn().notNull(),
		removedAt: createTimestampMsColumn(),
		removedByAuthUserId: uuid().references(() => users.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.organizationEntityId, table.memberAuthUserId] }),
		uniqueIndex("organization_membership_public_member_key").on(
			table.organizationEntityId,
			table.memberEntityId,
		),
		index("organization_membership_active_roster_idx")
			.on(table.organizationEntityId, table.memberEntityId)
			.where(sql`${table.removedAt} is null`),
		index("organization_membership_auth_state_idx").on(
			table.memberAuthUserId,
			table.removedAt,
			table.organizationEntityId,
		),
		index("organization_membership_entity_idx").on(
			table.memberEntityId,
			table.organizationEntityId,
		),
		index("organization_membership_invitation_idx").on(table.acceptedInvitationId),
		index("organization_membership_removed_by_idx")
			.on(table.removedByAuthUserId)
			.where(sql`${table.removedByAuthUserId} is not null`),
		foreignKey({
			name: "organization_membership_accepted_invitation_fk",
			columns: [
				table.acceptedInvitationId,
				table.organizationEntityId,
				table.memberAuthUserId,
				table.memberEntityId,
			],
			foreignColumns: [
				organizationMembershipInvitation.id,
				organizationMembershipInvitation.organizationEntityId,
				organizationMembershipInvitation.recipientAuthUserId,
				organizationMembershipInvitation.recipientEntityId,
			],
		}).onDelete("restrict"),
		check(
			"organization_membership_revision_check",
			sql`${table.revision} between 1 and 9007199254740991`,
		),
		check(
			"organization_membership_removal_check",
			sql`(${table.removedAt} is null and ${table.removedByAuthUserId} is null) or (${table.removedAt} is not null and ${table.removedByAuthUserId} is not null and ${table.removedAt} >= ${table.joinedAt})`,
		),
	],
);
