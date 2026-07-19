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
	UnitAccessInvitationResolutionValues,
	UnitAccessRealmRelationValues,
	UnitAccessRestrictionSubjectKindValues,
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
import { governanceReasonCode } from "./governance";
import { realm } from "./realm";

export const unitAccessSubjectKind = pgEnum(
	"unit_access_subject_kind",
	toEnumValues(UnitAccessSubjectKindValues),
);
export const unitAccessRealmRelation = pgEnum(
	"unit_access_realm_relation",
	toEnumValues(UnitAccessRealmRelationValues),
);
export const unitAccessInvitationResolution = pgEnum(
	"unit_access_invitation_resolution",
	toEnumValues(UnitAccessInvitationResolutionValues),
);
export const unitAccessRestrictionSubjectKind = pgEnum(
	"unit_access_restriction_subject_kind",
	toEnumValues(UnitAccessRestrictionSubjectKindValues),
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
		uniqueIndex("unit_access_binding_active_owner_key")
			.on(table.unitId)
			.where(sql`${table.revokedAt} is null and ${table.role} = 'owner'`),
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
		check(
			"unit_access_binding_subject_role_check",
			sql`(
				${table.subjectKind} = 'profile' or ${table.role} <> 'owner'
			) and (
				${table.subjectKind} <> 'authenticated' or ${table.role} in ('viewer', 'editor')
			)`,
		),
		check(
			"unit_access_binding_owner_scope_check",
			sql`${table.role} <> 'owner' or cardinality(${table.scope}) = 0`,
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

/** A Profile-mediated offer that has no access effect until the invitee accepts it. */
export const unitAccessInvitation = pgTable(
	"unit_access_invitation",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		invitedProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		role: unitAccessRole().notNull(),
		scope: text()
			.array()
			.default(sql`array[]::text[]`)
			.notNull(),
		invitedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		expiresAt: createTimestampMsColumn().notNull(),
		accessExpiresAt: createTimestampMsColumn(),
		resolution: unitAccessInvitationResolution(),
		resolvedAt: createTimestampMsColumn(),
		resolvedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		acceptedBindingId: uuid().references(() => unitAccessBinding.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("unit_access_invitation_unit_unresolved_idx")
			.on(table.unitId, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.resolution} is null`),
		index("unit_access_invitation_profile_unresolved_idx")
			.on(table.invitedProfileId, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.resolution} is null`),
		uniqueIndex("unit_access_invitation_accepted_binding_key")
			.on(table.acceptedBindingId)
			.where(sql`${table.acceptedBindingId} is not null`),
		index("unit_access_invitation_invited_by_idx").on(table.invitedByProfileId),
		index("unit_access_invitation_resolved_by_idx").on(table.resolvedByProfileId),
		check("unit_access_invitation_scope_check", scopeCheck(table.scope)),
		check(
			"unit_access_invitation_profiles_differ_check",
			sql`${table.invitedProfileId} <> ${table.invitedByProfileId}`,
		),
		check("unit_access_invitation_role_check", sql`${table.role} <> 'owner'::unit_access_role`),
		check(
			"unit_access_invitation_expiry_check",
			sql`${table.expiresAt} > ${table.createdAt} and (${table.accessExpiresAt} is null or ${table.accessExpiresAt} > ${table.createdAt})`,
		),
		check(
			"unit_access_invitation_resolution_shape_check",
			sql`(
				${table.resolution} is null and ${table.resolvedAt} is null and ${table.resolvedByProfileId} is null and ${table.acceptedBindingId} is null
			) or (
				${table.resolution} = 'accepted'::unit_access_invitation_resolution and ${table.resolvedAt} is not null and ${table.resolvedByProfileId} is not null and ${table.acceptedBindingId} is not null
			) or (
				${table.resolution} in ('declined'::unit_access_invitation_resolution, 'cancelled'::unit_access_invitation_resolution) and ${table.resolvedAt} is not null and ${table.resolvedByProfileId} is not null and ${table.acceptedBindingId} is null
			)`,
		),
	],
);

/** Profile and active Realm-member deny rules override every non-platform grant. */
export const unitAccessRestriction = pgTable(
	"unit_access_restriction",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		subjectKind: unitAccessRestrictionSubjectKind().notNull(),
		profileId: uuid().references(() => profile.id, { onDelete: "cascade" }),
		realmId: uuid().references(() => realm.id, { onDelete: "cascade" }),
		permission: unitPermission().notNull(),
		scope: text()
			.array()
			.default(sql`array[]::text[]`)
			.notNull(),
		reasonCode: governanceReasonCode().notNull(),
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
		uniqueIndex("unit_access_restriction_active_profile_scope_key")
			.on(table.unitId, table.profileId, table.permission, table.scope)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'profile'`),
		uniqueIndex("unit_access_restriction_active_realm_scope_key")
			.on(table.unitId, table.realmId, table.permission, table.scope)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'realm'`),
		index("unit_access_restriction_profile_active_idx")
			.on(table.profileId, table.unitId, table.permission)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'profile'`),
		index("unit_access_restriction_realm_active_idx")
			.on(table.realmId, table.unitId, table.permission)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'realm'`),
		index("unit_access_restriction_created_by_idx").on(table.createdByProfileId),
		check(
			"unit_access_restriction_subject_shape_check",
			sql`(
				${table.subjectKind} = 'profile' and ${table.profileId} is not null and ${table.realmId} is null
			) or (
				${table.subjectKind} = 'realm' and ${table.profileId} is null and ${table.realmId} is not null
			)`,
		),
		check("unit_access_restriction_scope_check", scopeCheck(table.scope)),
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
		reasonCode: governanceReasonCode().notNull(),
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
