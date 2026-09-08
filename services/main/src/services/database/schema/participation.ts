import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	integer,
	text,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn, createTimestampMsColumn, createUuidv7PrimaryKey } from "./columns";
import { users } from "./auth";
import { catalogSourceAdoptionProposal } from "./catalog-source";
import {
	entityIdentity,
	publishingIdentity,
	musicIdentity,
	programIdentity,
	softwareIdentity,
	groupingIdentity,
	referenceIdentity,
	distributionIdentity,
} from "./catalog-identity";

/** Private self binding. An imported public Entity never creates an account binding. */
export const authEntity = pgTable(
	"auth_entity",
	{
		authUserId: uuid()
			.primaryKey()
			.references(() => users.id, { onDelete: "cascade" }),
		entityId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		revision: bigint({ mode: "number" }).notNull().default(1),
		state: text().$type<"active" | "suspended">().notNull().default("active"),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		uniqueIndex("auth_entity_self_key").on(table.entityId),
		check("auth_entity_revision_check", sql`${table.revision} between 1 and 9007199254740991`),
		check("auth_entity_state_check", inArray(table.state, ["active", "suspended"])),
	],
);

/** Participation lifecycle belongs only to identities admitted to act, not every catalog subject. */
export const entityParticipation = pgTable(
	"entity_participation",
	{
		entityId: uuid()
			.primaryKey()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		state: text().$type<"active" | "recovery_required">().notNull().default("active"),
		revision: bigint({ mode: "number" }).notNull().default(1),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		check(
			"entity_participation_state_check",
			inArray(table.state, ["active", "recovery_required"]),
		),
		check(
			"entity_participation_revision_check",
			sql`${table.revision} between 1 and 9007199254740991`,
		),
	],
);

/** Immutable, private explanation of an evidence-reviewed recovery or initial claim. */
export const entityRecoveryEvent = pgTable(
	"entity_recovery_event",
	{
		id: createUuidv7PrimaryKey(),
		entityId: uuid()
			.notNull()
			.references(() => entityParticipation.entityId, { onDelete: "restrict" }),
		revision: bigint({ mode: "number" }).notNull(),
		operatorAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		recipientAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		evidence: text().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		uniqueIndex("entity_recovery_event_revision_key").on(table.entityId, table.revision),
		check(
			"entity_recovery_event_evidence_check",
			sql`octet_length(${table.evidence}) between 1 and 16384`,
		),
	],
);

export const AccountErasureStageValues = [
	"sessions",
	"credentials",
	"quota_account_leases",
	"quota_account_daily",
	"quota_account_rates",
	"quota_reservations",
	"quota_account_binding",
	"api_tokens",
	"verification",
	"auth_mail",
	"preferences",
	"notifications",
	"notification_preferences",
	"notification_stats",
	"sent_messages",
	"conversation_reads",
	"conversation_stats",
	"account_blocks",
	"progress",
	"progress_entries",
	"progress_nodes",
	"recommendation_events",
	"recommendation_exclusions",
	"studio_visits",
	"studio_candidates",
	"follow_preferences",
	"membership_sent_invitations",
	"organization_membership_events",
	"organization_memberships",
	"membership_received_invitations",
	"favorite_history",
	"favorites",
	"favorites_state",
	"tag_subscriptions",
	"personal_tags",
	"private_images",
	"complete",
] as const;

/** Restartable bounded deletion, after synchronous credential invalidation and controller suspension. */
export const accountErasure = pgTable(
	"account_erasure",
	{
		authUserId: uuid()
			.primaryKey()
			.references(() => users.id, { onDelete: "restrict" }),
		selfEntityId: uuid().references(() => entityIdentity.id, { onDelete: "restrict" }),
		priorEmail: text(),
		stage: text().$type<(typeof AccountErasureStageValues)[number]>().notNull().default("sessions"),
		completedBatches: integer().notNull().default(0),
		availableAt: createTimestampMsColumn().notNull().defaultNow(),
		createdAt: createCreatedAtColumn(),
		completedAt: createTimestampMsColumn(),
	},
	(table) => [
		check("account_erasure_stage_check", inArray(table.stage, AccountErasureStageValues)),
		check(
			"account_erasure_complete_check",
			sql`(${table.stage} = 'complete') = (${table.completedAt} is not null) and (${table.stage} <> 'complete' or (${table.priorEmail} is null and ${table.selfEntityId} is null))`,
		),
		index("account_erasure_ready_idx")
			.on(table.availableAt, table.authUserId)
			.where(sql`${table.completedAt} is null`),
	],
);

/** A named machine identity; credentials hold only a hash, never a reusable plaintext secret. */
export const servicePrincipal = pgTable(
	"service_principal",
	{
		id: createUuidv7PrimaryKey(),
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		entityId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		name: text().notNull(),
		credentialDigest: text().notNull(),
		createdByAuthUserId: uuid().references(() => users.id, { onDelete: "set null" }),
		revision: bigint({ mode: "number" }).notNull().default(1),
		revokedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		uniqueIndex("service_principal_auth_key").on(table.authUserId),
		uniqueIndex("service_principal_entity_key").on(table.entityId),
		index("service_principal_controller_idx")
			.on(table.createdByAuthUserId, table.id)
			.where(sql`${table.revokedAt} is null`),
		uniqueIndex("service_principal_credential_key").on(table.credentialDigest),
		check(
			"service_principal_credential_digest_check",
			sql`${table.credentialDigest} ~ '^[0-9a-f]{64}$'`,
		),
		check("service_principal_name_check", sql`length(btrim(${table.name})) between 1 and 160`),
		check(
			"service_principal_revision_check",
			sql`${table.revision} between 1 and 9007199254740991`,
		),
	],
);

export const ParticipationCapabilityValues = [
	"catalog.read",
	"catalog.edit",
	"entity.publish",
	"entity.membership",
	"entity.security",
	"proposal.adopt",
] as const;
/** Explicit target alternatives have concrete owner FKs; no routing-index or universal-parent FK. */
export const participationGrant = pgTable(
	"participation_grant",
	{
		id: createUuidv7PrimaryKey(),
		authUserId: uuid().references(() => users.id, { onDelete: "cascade" }),
		servicePrincipalId: uuid().references(() => servicePrincipal.id, { onDelete: "restrict" }),
		actingEntityId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		capability: text().$type<(typeof ParticipationCapabilityValues)[number]>().notNull(),
		proposalSourceRecordId: uuid(),
		proposalId: uuid(),
		publishingId: uuid().references(() => publishingIdentity.id, { onDelete: "restrict" }),
		musicId: uuid().references(() => musicIdentity.id, { onDelete: "restrict" }),
		programId: uuid().references(() => programIdentity.id, { onDelete: "restrict" }),
		softwareId: uuid().references(() => softwareIdentity.id, { onDelete: "restrict" }),
		entityId: uuid().references(() => entityIdentity.id, { onDelete: "restrict" }),
		groupingId: uuid().references(() => groupingIdentity.id, { onDelete: "restrict" }),
		referenceId: uuid().references(() => referenceIdentity.id, { onDelete: "restrict" }),
		distributionId: uuid().references(() => distributionIdentity.id, { onDelete: "restrict" }),
		revision: bigint({ mode: "number" }).notNull().default(1),
		expiresAt: createTimestampMsColumn(),
		revokedAt: createTimestampMsColumn(),
		createdByAuthUserId: uuid().references(() => users.id, { onDelete: "set null" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			name: "participation_grant_proposal_fk",
			columns: [table.proposalSourceRecordId, table.proposalId],
			foreignColumns: [
				catalogSourceAdoptionProposal.sourceRecordId,
				catalogSourceAdoptionProposal.id,
			],
		}).onDelete("restrict"),
		check(
			"participation_grant_proposal_scope_check",
			sql`(${table.capability} = 'proposal.adopt' and num_nonnulls(${table.proposalSourceRecordId}, ${table.proposalId}) = 2) or (${table.capability} <> 'proposal.adopt' and num_nonnulls(${table.proposalSourceRecordId}, ${table.proposalId}) = 0)`,
		),
		check(
			"participation_grant_principal_check",
			sql`num_nonnulls(${table.authUserId}, ${table.servicePrincipalId}) = 1`,
		),
		check(
			"participation_grant_target_check",
			sql`num_nonnulls(${table.publishingId}, ${table.musicId}, ${table.programId}, ${table.softwareId}, ${table.entityId}, ${table.groupingId}, ${table.referenceId}, ${table.distributionId}) = 1`,
		),
		check(
			"participation_grant_capability_check",
			inArray(table.capability, ParticipationCapabilityValues),
		),
		check(
			"participation_grant_revision_check",
			sql`${table.revision} between 1 and 9007199254740991`,
		),
		index("participation_grant_auth_idx").on(table.authUserId, table.id),
		index("participation_grant_service_idx")
			.on(table.servicePrincipalId, table.id)
			.where(sql`${table.servicePrincipalId} is not null and ${table.revokedAt} is null`),
		index("participation_grant_entity_idx").on(table.actingEntityId, table.id),
		index("participation_grant_active_auth_idx")
			.on(table.authUserId, table.id)
			.where(sql`${table.revokedAt} is null`),
		index("participation_grant_active_security_idx")
			.on(table.actingEntityId, table.authUserId)
			.where(sql`${table.revokedAt} is null and ${table.capability} = 'entity.security'`),
		...[
			table.publishingId,
			table.musicId,
			table.programId,
			table.softwareId,
			table.entityId,
			table.groupingId,
			table.referenceId,
			table.distributionId,
		].map((target, position) =>
			index(`participation_grant_target_${position}_idx`)
				.on(target, table.id)
				.where(sql`${target} is not null`),
		),
	],
);

/** Private append-only authority evidence; never part of public Entity presentation. */
export const participationGrantEvent = pgTable(
	"participation_grant_event",
	{
		id: createUuidv7PrimaryKey(),
		grantId: uuid()
			.notNull()
			.references(() => participationGrant.id, { onDelete: "restrict" }),
		revision: bigint({ mode: "number" }).notNull(),
		operation: text().$type<"grant" | "revoke">().notNull(),
		operatorAuthUserId: uuid().references(() => users.id, { onDelete: "set null" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		uniqueIndex("participation_grant_event_revision_key").on(table.grantId, table.revision),
		check(
			"participation_grant_event_operation_check",
			inArray(table.operation, ["grant", "revoke"]),
		),
	],
);
