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
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	CapabilityAuthorityValues,
	type ContentLanguage,
	RealmJoinPolicyValues,
	RealmMemberRoleValues,
	RealmMemberStateValues,
	RealmPinKindValues,
	RealmUnitStatusValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	fractionalIndexPosition,
	ordinalPosition,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile, unit } from "./core";

export const realmJoinPolicy = pgEnum("realm_join_policy", toEnumValues(RealmJoinPolicyValues));
export const realmMemberRole = pgEnum("realm_member_role", toEnumValues(RealmMemberRoleValues));
export const realmMemberState = pgEnum("realm_member_state", toEnumValues(RealmMemberStateValues));
export const realmPinKind = pgEnum("realm_pin_kind", toEnumValues(RealmPinKindValues));
export const realmUnitStatus = pgEnum("realm_unit_status", toEnumValues(RealmUnitStatusValues));
export const capabilityAuthority = pgEnum(
	"capability_authority",
	toEnumValues(CapabilityAuthorityValues),
);

export const realm = pgTable("realm", {
	id: uuid()
		.primaryKey()
		.references(() => unit.id, { onDelete: "cascade" }),
	joinPolicy: realmJoinPolicy().default("open").notNull(),
	createdAt: createCreatedAtColumn(),
	updatedAt: createUpdatedAtColumn(),
});

/** Realm-owned menu content, independent from the Menu Blocks that present it. */
export const realmNavigation = pgTable(
	"realm_navigation",
	{
		id: createUuidv7PrimaryKey(),
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		document: createJsonDocumentColumn().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("realm_navigation_realm_created_idx").on(table.realmId, table.createdAt, table.id),
	],
);

export const realmMember = pgTable(
	"realm_member",
	{
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		role: realmMemberRole().default("member").notNull(),
		state: realmMemberState().default("active").notNull(),
		joinedAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.profileId] }),
		index("realm_member_realm_state_role_idx").on(table.realmId, table.state, table.role),
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
		requireOnJoin: boolean().default(false).notNull(),
		requireOnPost: boolean().default(false).notNull(),
		requireOnUpdate: boolean().default(true).notNull(),
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
		/** Realm-local moderation state; this is not a Unit field-edit lock. */
		locked: boolean().default(false).notNull(),
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
		index("realm_unit_unit_idx").on(table.unitId),
		check("realm_unit_not_self_check", sql`${table.realmId} <> ${table.unitId}`),
	],
);

export const capabilityGrant = pgTable(
	"capability_grant",
	{
		id: createUuidv7PrimaryKey(),
		authority: capabilityAuthority().notNull(),
		realmId: uuid().references(() => realm.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		capability: text().notNull(),
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
		unique("capability_grant_identity_key")
			.on(table.authority, table.realmId, table.profileId, table.capability)
			.nullsNotDistinct(),
		index("capability_grant_profile_expiry_idx").on(table.profileId, table.expiresAt),
		index("capability_grant_realm_idx").on(table.realmId),
		index("capability_grant_granted_by_idx").on(table.grantedByProfileId),
		index("capability_grant_revoked_by_idx").on(table.revokedByProfileId),
		check(
			"capability_grant_authority_check",
			sql`(${table.authority} = 'realm'::capability_authority) = (${table.realmId} is not null)`,
		),
		check("capability_grant_capability_not_blank", sql`btrim(${table.capability}) <> ''`),
		check(
			"capability_grant_revocation_check",
			sql`(${table.revokedAt} is null) = (${table.revokedByProfileId} is null)`,
		),
		check(
			"capability_grant_expiry_check",
			sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.createdAt}`,
		),
	],
);
