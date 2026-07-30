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
	DelegableUnitPermissionValues,
	type DelegableUnitPermission,
	type UnitPermission,
	UnitAccessInvitationResolutionValues,
	UnitAccessRestrictionSubjectKindValues,
	UnitAccessSubjectKindValues,
} from "@rezics/access";

import { toEnumValues } from "./contract-values";
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
export const unitAccessInvitationResolution = pgEnum(
	"unit_access_invitation_resolution",
	toEnumValues(UnitAccessInvitationResolutionValues),
);
export const unitAccessRestrictionSubjectKind = pgEnum(
	"unit_access_restriction_subject_kind",
	toEnumValues(UnitAccessRestrictionSubjectKindValues),
);
/*
 * PostgreSQL cannot remove enum labels in place. The retired label remains in
 * the physical enum, while checks on every consuming column make the narrower
 * application type true for all stored rows.
 */
const unitPermissionStorageValues = toEnumValues([
	"unit.read",
	"unit.update",
	"unit.status.update",
	"unit.history.restore",
	"unit.access.manage",
	"unit.ownership.transfer",
	"unit.association.manage",
	"unit.tag-curation.manage",
	"unit.realm-publication.manage",
	"unit.delete",
	"realm.contribute",
	"realm.units.create",
	"realm.post.replies.create",
	"realm.settings.update",
	"realm.members.read",
	"realm.members.manage",
	"realm.rules.update",
	"realm.pins.manage",
	"realm.tags.manage",
	"realm.units.moderate",
	"entity.association.credit.request",
	"entity.association.credit.direct",
	"entity.association.subject.request",
	"entity.association.subject.direct",
] as const satisfies readonly (UnitPermission | "unit.delete")[]) as [
	UnitPermission,
	...UnitPermission[],
];
export const unitPermission = pgEnum("unit_permission", unitPermissionStorageValues);

const scopeCheck = (scope: AnyPgColumn) =>
	sql`cardinality(${scope}) <= 8 and (
		cardinality(${scope}) = 0 or
		array_to_string(${scope}, '/') ~ '^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)*$'
	)`;

/** Append-only Unit ownership. At most one non-revoked owner exists for a Unit. */
export const unitOwnership = pgTable(
	"unit_ownership",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		assignedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		revokedAt: createTimestampMsColumn(),
		revokedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("unit_ownership_active_unit_key")
			.on(table.unitId)
			.where(sql`${table.revokedAt} is null`),
		index("unit_ownership_profile_active_idx")
			.on(table.profileId, table.unitId)
			.where(sql`${table.revokedAt} is null`),
		index("unit_ownership_assigned_by_idx").on(table.assignedByProfileId),
		index("unit_ownership_revoked_by_idx").on(table.revokedByProfileId),
		check(
			"unit_ownership_revocation_shape_check",
			sql`(${table.revokedAt} is null) = (${table.revokedByProfileId} is null)`,
		),
	],
);

/**
 * An atomic permission grant to a Profile, all active members of a Realm, or
 * every authenticated Profile. Empty scope is the Unit root.
 */
export const unitAccessGrant = pgTable(
	"unit_access_grant",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		subjectKind: unitAccessSubjectKind().notNull(),
		profileId: uuid().references(() => profile.id, { onDelete: "cascade" }),
		realmId: uuid().references(() => realm.id, { onDelete: "cascade" }),
		permission: unitPermission().$type<DelegableUnitPermission>().notNull(),
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
		uniqueIndex("unit_access_grant_active_profile_scope_key")
			.on(table.unitId, table.profileId, table.permission, table.scope)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'profile'`),
		uniqueIndex("unit_access_grant_active_realm_scope_key")
			.on(table.unitId, table.realmId, table.permission, table.scope)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'realm'`),
		uniqueIndex("unit_access_grant_active_authenticated_scope_key")
			.on(table.unitId, table.permission, table.scope)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'authenticated'`),
		index("unit_access_grant_profile_active_idx")
			.on(table.profileId, table.unitId, table.permission)
			.where(sql`${table.revokedAt} is null`),
		index("unit_access_grant_unit_transfer_candidate_idx")
			.on(table.unitId, table.permission, table.profileId)
			.where(
				sql`${table.revokedAt} is null
					and ${table.expiresAt} is null
					and ${table.subjectKind} = 'profile'
					and cardinality(${table.scope}) = 0`,
			),
		index("unit_access_grant_realm_active_idx")
			.on(table.realmId, table.unitId, table.permission)
			.where(sql`${table.revokedAt} is null`),
		index("unit_access_grant_granted_by_idx").on(table.grantedByProfileId),
		check(
			"unit_access_grant_subject_shape_check",
			sql`(
				${table.subjectKind} = 'profile' and ${table.profileId} is not null and ${table.realmId} is null
			) or (
				${table.subjectKind} = 'realm' and ${table.profileId} is null and ${table.realmId} is not null
			) or (
				${table.subjectKind} = 'authenticated' and ${table.profileId} is null and ${table.realmId} is null
			)`,
		),
		check("unit_access_grant_scope_check", scopeCheck(table.scope)),
		check(
			"unit_access_grant_permission_delegable_check",
			sql`${table.permission} not in (
				'unit.ownership.transfer'::unit_permission,
				'unit.delete'::unit_permission
			)`,
		),
		check(
			"unit_access_grant_expiry_check",
			sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.createdAt}`,
		),
		check(
			"unit_access_grant_revocation_shape_check",
			sql`(${table.revokedAt} is null) = (${table.revokedByProfileId} is null)`,
		),
	],
);

/** A Profile-mediated offer whose permissions have no effect until accepted. */
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
		permissions: unitPermission().$type<DelegableUnitPermission>().array().notNull(),
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
		index("unit_access_invitation_unit_transfer_candidate_idx")
			.on(table.unitId, table.invitedProfileId)
			.where(
				sql`${table.resolution} = 'accepted'
					and ${table.accessExpiresAt} is null
					and cardinality(${table.scope}) = 0`,
			),
		index("unit_access_invitation_invited_by_idx").on(table.invitedByProfileId),
		index("unit_access_invitation_resolved_by_idx").on(table.resolvedByProfileId),
		check("unit_access_invitation_scope_check", scopeCheck(table.scope)),
		check(
			"unit_access_invitation_permissions_check",
			sql`cardinality(${table.permissions}) between 1 and ${DelegableUnitPermissionValues.length}
				and array_position(${table.permissions}, 'unit.ownership.transfer'::unit_permission) is null
				and array_position(${table.permissions}, 'unit.delete'::unit_permission) is null`,
		),
		check(
			"unit_access_invitation_profiles_differ_check",
			sql`${table.invitedProfileId} <> ${table.invitedByProfileId}`,
		),
		check(
			"unit_access_invitation_expiry_check",
			sql`${table.expiresAt} > ${table.createdAt} and (${table.accessExpiresAt} is null or ${table.accessExpiresAt} > ${table.createdAt})`,
		),
		check(
			"unit_access_invitation_resolution_shape_check",
			sql`(
				${table.resolution} is null and ${table.resolvedAt} is null and ${table.resolvedByProfileId} is null
			) or (
				${table.resolution} is not null and ${table.resolvedAt} is not null and ${table.resolvedByProfileId} is not null
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
		permission: unitPermission().$type<DelegableUnitPermission>().notNull(),
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
			"unit_access_restriction_permission_delegable_check",
			sql`${table.permission} not in (
				'unit.ownership.transfer'::unit_permission,
				'unit.delete'::unit_permission
			)`,
		),
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
