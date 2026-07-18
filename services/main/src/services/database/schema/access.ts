import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	check,
	index,
	pgEnum,
	text,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	UnitAccessRealmRelationValues,
	UnitAccessRoleValues,
	UnitAccessSubjectKindValues,
	UnitPermissionValues,
	UnitProtectionModeValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile, unit } from "./core";
import { realm } from "./realm";

export const unitAccessSubjectKind = pgEnum(
	"unit_access_subject_kind",
	toEnumValues(UnitAccessSubjectKindValues),
);
export const unitAccessRealmRelation = pgEnum(
	"unit_access_realm_relation",
	toEnumValues(UnitAccessRealmRelationValues),
);
export const unitAccessRole = pgEnum("unit_access_role", toEnumValues(UnitAccessRoleValues));
export const unitPermission = pgEnum("unit_permission", toEnumValues(UnitPermissionValues));
export const unitProtectionMode = pgEnum(
	"unit_protection_mode",
	toEnumValues(UnitProtectionModeValues),
);

const scopeCheck = (scope: AnyPgColumn) =>
	sql`cardinality(${scope}) <= 8 and (
		cardinality(${scope}) = 0 or
		array_to_string(${scope}, '/') ~ '^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)*$'
	)`;

/**
 * Grant to a Profile, a Realm relationship, or every authenticated Profile.
 * Empty scope is the Unit root; a grant covers that scope and descendants.
 */
export const unitAccessBinding = pgTable(
	"unit_access_binding",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		subjectKind: unitAccessSubjectKind().notNull(),
		profileId: uuid().references(() => profile.id, { onDelete: "cascade" }),
		realmId: uuid().references(() => realm.id, { onDelete: "cascade" }),
		realmRelation: unitAccessRealmRelation(),
		role: unitAccessRole().notNull(),
		scope: text()
			.array()
			.default(sql`array[]::text[]`)
			.notNull(),
		grantedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		expiresAt: createTimestampMsColumn(),
		revokedAt: createTimestampMsColumn(),
		revokedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("unit_access_binding_active_profile_scope_key")
			.on(table.unitId, table.profileId, table.scope)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'profile'`),
		uniqueIndex("unit_access_binding_active_realm_scope_key")
			.on(table.unitId, table.realmId, table.realmRelation, table.scope)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'realm'`),
		uniqueIndex("unit_access_binding_active_authenticated_scope_key")
			.on(table.unitId, table.scope)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'authenticated'`),
		index("unit_access_binding_profile_active_idx")
			.on(table.profileId, table.unitId, table.role)
			.where(sql`${table.revokedAt} is null`),
		index("unit_access_binding_realm_active_idx")
			.on(table.realmId, table.unitId, table.realmRelation, table.role)
			.where(sql`${table.revokedAt} is null`),
		index("unit_access_binding_granted_by_idx").on(table.grantedByProfileId),
		check(
			"unit_access_binding_subject_shape_check",
			sql`(
				${table.subjectKind} = 'profile' and ${table.profileId} is not null and ${table.realmId} is null and ${table.realmRelation} is null
			) or (
				${table.subjectKind} = 'realm' and ${table.profileId} is null and ${table.realmId} is not null and ${table.realmRelation} is not null
			) or (
				${table.subjectKind} = 'authenticated' and ${table.profileId} is null and ${table.realmId} is null and ${table.realmRelation} is null
			)`,
		),
		check("unit_access_binding_scope_check", scopeCheck(table.scope)),
		check(
			"unit_access_binding_expiry_check",
			sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.createdAt}`,
		),
		check(
			"unit_access_binding_revocation_shape_check",
			sql`(${table.revokedAt} is null) = (${table.revokedByProfileId} is null)`,
		),
	],
);

/** Profile-specific deny rules override every non-platform grant. */
export const unitAccessRestriction = pgTable(
	"unit_access_restriction",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		permission: unitPermission().notNull(),
		scope: text()
			.array()
			.default(sql`array[]::text[]`)
			.notNull(),
		reason: text().notNull(),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		expiresAt: createTimestampMsColumn(),
		revokedAt: createTimestampMsColumn(),
		revokedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("unit_access_restriction_active_subject_scope_key")
			.on(table.unitId, table.profileId, table.permission, table.scope)
			.where(sql`${table.revokedAt} is null`),
		index("unit_access_restriction_profile_active_idx")
			.on(table.profileId, table.unitId, table.permission)
			.where(sql`${table.revokedAt} is null`),
		index("unit_access_restriction_created_by_idx").on(table.createdByProfileId),
		check("unit_access_restriction_scope_check", scopeCheck(table.scope)),
		check("unit_access_restriction_reason_check", sql`btrim(${table.reason}) <> ''`),
		check(
			"unit_access_restriction_expiry_check",
			sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.createdAt}`,
		),
		check(
			"unit_access_restriction_revocation_shape_check",
			sql`(${table.revokedAt} is null) = (${table.revokedByProfileId} is null)`,
		),
	],
);

/** Guardrail on a Unit subtree; separate from the subject grant. */
export const unitProtection = pgTable(
	"unit_protection",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		scope: text()
			.array()
			.default(sql`array[]::text[]`)
			.notNull(),
		mode: unitProtectionMode().notNull(),
		reason: text().notNull(),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		expiresAt: createTimestampMsColumn(),
		revokedAt: createTimestampMsColumn(),
		revokedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("unit_protection_active_scope_key")
			.on(table.unitId, table.scope)
			.where(sql`${table.revokedAt} is null`),
		index("unit_protection_created_by_idx").on(table.createdByProfileId),
		check("unit_protection_scope_check", scopeCheck(table.scope)),
		check("unit_protection_reason_check", sql`btrim(${table.reason}) <> ''`),
		check(
			"unit_protection_expiry_check",
			sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.createdAt}`,
		),
		check(
			"unit_protection_revocation_shape_check",
			sql`(${table.revokedAt} is null) = (${table.revokedByProfileId} is null)`,
		),
	],
);
