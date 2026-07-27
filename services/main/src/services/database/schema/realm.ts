import { PlatformCapabilityValues } from "@rezics/access";
import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	pgEnum,
	primaryKey,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	type ContentLanguage,
	RealmJoinPolicyValues,
	RealmMemberStateValues,
	RealmPinKindValues,
	RealmRuleAcknowledgementModeValues,
	RealmUnitStatusValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	fractionalIndexPosition,
	ordinalPosition,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile, unit } from "./core";

export const realmJoinPolicy = pgEnum("realm_join_policy", toEnumValues(RealmJoinPolicyValues));
export const realmMemberState = pgEnum("realm_member_state", toEnumValues(RealmMemberStateValues));
export const realmPinKind = pgEnum("realm_pin_kind", toEnumValues(RealmPinKindValues));
export const realmRuleAcknowledgementMode = pgEnum(
	"realm_rule_acknowledgement_mode",
	toEnumValues(RealmRuleAcknowledgementModeValues),
);
export const realmUnitStatus = pgEnum("realm_unit_status", toEnumValues(RealmUnitStatusValues));
export const platformCapability = pgEnum(
	"platform_capability",
	toEnumValues(PlatformCapabilityValues),
);

export const realm = pgTable("realm", {
	id: uuid()
		.primaryKey()
		.references(() => unit.id, { onDelete: "cascade" }),
	joinPolicy: realmJoinPolicy().default("open").notNull(),
	createdAt: createCreatedAtColumn(),
	updatedAt: createUpdatedAtColumn(),
});

export const realmMember = pgTable(
	"realm_member",
	{
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		state: realmMemberState().default("active").notNull(),
		joinedAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.profileId] }),
		index("realm_member_realm_state_idx").on(table.realmId, table.state),
		index("realm_member_profile_idx").on(table.profileId),
	],
);

export const realmRuleRevision = pgTable(
	"realm_rule_revision",
	{
		id: createUuidv7PrimaryKey(),
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		version: integer().notNull(),
		acknowledgementMode: realmRuleAcknowledgementMode().default("explicit").notNull(),
		requireOnJoin: boolean().default(false).notNull(),
		requireOnPost: boolean().default(false).notNull(),
		createdByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		publishedAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("realm_rule_revision_realm_version_key").on(table.realmId, table.version),
		index("realm_rule_revision_realm_published_idx").on(table.realmId, table.version.desc()),
		index("realm_rule_revision_created_by_idx").on(table.createdByProfileId),
		check("realm_rule_revision_version_check", sql`${table.version} > 0`),
	],
);

export const realmRule = pgTable(
	"realm_rule",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		revisionId: uuid()
			.notNull()
			.references(() => realmRuleRevision.id, { onDelete: "cascade" }),
		position: ordinalPosition().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		index("realm_rule_revision_position_idx").on(table.revisionId, table.position, table.id),
	],
);

export const realmRuleAcceptance = pgTable(
	"realm_rule_acceptance",
	{
		revisionId: uuid()
			.notNull()
			.references(() => realmRuleRevision.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		language: text().$type<ContentLanguage>(),
		acceptedAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.revisionId, table.profileId] }),
		index("realm_rule_acceptance_profile_idx").on(table.profileId, table.acceptedAt.desc()),
		check(
			"realm_rule_acceptance_language_check",
			sql`${table.language} is null or ${table.language} in ('zh', 'en')`,
		),
	],
);

export const realmPin = pgTable(
	"realm_pin",
	{
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		kind: realmPinKind().default("pinned").notNull(),
		position: fractionalIndexPosition()
			.default(sql`'a0'::text`)
			.notNull(),
		createdByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.unitId] }),
		index("realm_pin_realm_kind_position_idx").on(
			table.realmId,
			table.kind,
			table.position,
			table.unitId,
		),
		index("realm_pin_unit_idx").on(table.unitId),
		index("realm_pin_created_by_idx").on(table.createdByProfileId),
		check("realm_pin_not_self_check", sql`${table.realmId} <> ${table.unitId}`),
	],
);

export const realmUnit = pgTable(
	"realm_unit",
	{
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		/** Rejects new Post relations targeting this Unit in this Realm. */
		postTargetingLocked: boolean().default(false).notNull(),
		status: realmUnitStatus().default("visible").notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.unitId] }),
		index("realm_unit_realm_status_created_idx").on(
			table.realmId,
			table.status,
			table.createdAt.desc(),
			table.unitId,
		),
		index("realm_unit_moderation_queue_idx").on(
			table.realmId,
			table.status,
			table.updatedAt.desc(),
			table.unitId.desc(),
		),
		index("realm_unit_unit_realm_idx").on(table.unitId, table.realmId),
		check("realm_unit_not_self_check", sql`${table.realmId} <> ${table.unitId}`),
	],
);

export const platformCapabilityGrant = pgTable(
	"platform_capability_grant",
	{
		id: createUuidv7PrimaryKey(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		capability: platformCapability().notNull(),
		grantedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		expiresAt: createTimestampMsColumn(),
		revokedAt: createTimestampMsColumn(),
		revokedByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("platform_capability_grant_active_key")
			.on(table.profileId, table.capability)
			.where(sql`${table.revokedAt} is null`),
		index("platform_capability_grant_profile_expiry_idx").on(table.profileId, table.expiresAt),
		index("platform_capability_grant_granted_by_idx").on(table.grantedByProfileId),
		index("platform_capability_grant_revoked_by_idx").on(table.revokedByProfileId),
		check(
			"platform_capability_grant_revocation_check",
			sql`(${table.revokedAt} is null) = (${table.revokedByProfileId} is null)`,
		),
		check(
			"platform_capability_grant_expiry_check",
			sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.createdAt}`,
		),
	],
);
