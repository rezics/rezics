import { unitReferenceColumns, unitReferenceConstraints } from "./unit-reference-columns";
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
import { users } from "./auth";

import {
	type DelegableUnitPermission,
	type RealmAccessSubjectRelation,
	type UnitPermission,
	DelegableUnitPermissionValues,
	RealmAccessSubjectRelationValues,
	UnitAccessInvitationResolutionValues,
	UnitAccessRestrictionSubjectKindValues,
	UnitAccessSubjectKindValues,
} from "@rezics/access";
import { pgTable } from "./base";

import { entityIdentity } from "./catalog-identity";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { toEnumValues } from "./contract-values";
import { governanceDecision } from "./governance";
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
export const realmAccessSubjectRelation = pgEnum(
	"realm_access_subject_relation",
	toEnumValues(RealmAccessSubjectRelationValues),
);
/*
 * PostgreSQL cannot remove enum labels in place. The retired label remains in
 * the physical enum, while checks on every consuming column make the narrower
 * application type true for all stored rows.
 */
const unitPermissionStorageValues = toEnumValues([
	"unit.read",
	"unit.update",
	"unit.metadata-only.update",
	"unit.status.update",
	"unit.history.restore",
	"unit.access.manage",
	"unit.ownership.transfer",
	"unit.association.manage",
	"unit.tag-curation.manage",
	"unit.reference-curation.manage",
	"unit.realm-publication.manage",
	"zone.pages.manage",
	"zone.theme.manage",
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
	"realm.tag-voting.update",
	"realm.tag-contexts.manage",
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
		unitId: uuid().notNull(),
		profileId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		assignedByProfileId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		revokedAt: createTimestampMsColumn(),
		revokedByProfileId: uuid().references(() => entityIdentity.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),

		...unitReferenceColumns("unit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("unit_ownership", "unit", table, false, table.unitId),

		uniqueIndex("unit_ownership_active_unit_key")
			.on(table.unitId)
			.where(sql`${table.revokedAt} is null`),
		index("unit_ownership_profile_realm_active_idx")
			.on(table.profileId, table.unitRealmId)
			.where(sql`${table.revokedAt} is null and ${table.unitRealmId} is not null`),
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
		unitId: uuid().notNull(),
		subjectKind: unitAccessSubjectKind().notNull(),
		authUserId: uuid().references(() => users.id, { onDelete: "cascade" }),
		realmId: uuid().references(() => realm.id, { onDelete: "cascade" }),
		realmRelation: realmAccessSubjectRelation().$type<RealmAccessSubjectRelation>(),
		permission: unitPermission().$type<DelegableUnitPermission>().notNull(),
		scope: text().array().default(sql`array[]::text[]`).notNull(),
		grantedByAuthUserId: uuid().references(() => users.id, { onDelete: "restrict" }),
		expiresAt: createTimestampMsColumn(),
		revokedAt: createTimestampMsColumn(),
		revokedByAuthUserId: uuid().references(() => users.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),

		...unitReferenceColumns("unit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("unit_access_grant", "unit", table, false, table.unitId),

		uniqueIndex("unit_access_grant_active_auth_user_scope_key")
			.on(table.unitId, table.authUserId, table.permission, table.scope)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'auth'`),
		uniqueIndex("unit_access_grant_active_realm_scope_key")
			.on(table.unitId, table.realmId, table.realmRelation, table.permission, table.scope)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'realm'`),
		uniqueIndex("unit_access_grant_active_authenticated_scope_key")
			.on(table.unitId, table.permission, table.scope)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'authenticated'`),
		index("unit_access_grant_auth_managed_realm_idx")
			.on(table.authUserId, table.unitRealmId)
			.where(
				sql`${table.subjectKind} = 'auth' and ${table.permission} = 'unit.access.manage' and cardinality(${table.scope}) = 0 and ${table.revokedAt} is null and ${table.unitRealmId} is not null`,
			),
		index("unit_access_grant_member_managed_realm_idx")
			.on(table.realmId, table.unitRealmId)
			.where(
				sql`${table.subjectKind} = 'realm' and ${table.realmRelation} = 'member' and ${table.permission} = 'unit.access.manage' and cardinality(${table.scope}) = 0 and ${table.revokedAt} is null and ${table.unitRealmId} is not null`,
			),
		index("unit_access_grant_auth_user_active_idx")
			.on(table.authUserId, table.unitId, table.permission)
			.where(sql`${table.revokedAt} is null`),
		index("unit_access_grant_unit_transfer_candidate_idx")
			.on(table.unitId, table.permission, table.authUserId)
			.where(
				sql`${table.revokedAt} is null
					and ${table.expiresAt} is null
					and ${table.subjectKind} = 'auth'
					and cardinality(${table.scope}) = 0`,
			),
		index("unit_access_grant_realm_active_idx")
			.on(table.realmId, table.unitId, table.permission)
			.where(sql`${table.revokedAt} is null`),
		index("unit_access_grant_granted_by_idx").on(table.grantedByAuthUserId),
		check(
			"unit_access_grant_subject_shape_check",
			sql`(
				${table.subjectKind} = 'auth' and ${table.authUserId} is not null and ${table.realmId} is null and ${table.realmRelation} is null
			) or (
				${table.subjectKind} = 'realm' and ${table.authUserId} is null and ${table.realmId} is not null and ${table.realmRelation} is not null
			) or (
				${table.subjectKind} = 'authenticated' and ${table.authUserId} is null and ${table.realmId} is null and ${table.realmRelation} is null
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
			sql`(${table.revokedAt} is null) = (${table.revokedByAuthUserId} is null)`,
		),
	],
);

/** A Profile-mediated offer whose permissions have no effect until accepted. */
export const unitAccessInvitation = pgTable(
	"unit_access_invitation",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid().notNull(),
		invitedAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		permissions: unitPermission().$type<DelegableUnitPermission>().array().notNull(),
		scope: text().array().default(sql`array[]::text[]`).notNull(),
		invitedByAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		expiresAt: createTimestampMsColumn().notNull(),
		accessExpiresAt: createTimestampMsColumn(),
		resolution: unitAccessInvitationResolution(),
		resolvedAt: createTimestampMsColumn(),
		resolvedByAuthUserId: uuid().references(() => users.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),

		...unitReferenceColumns("unit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("unit_access_invitation", "unit", table, false, table.unitId),

		index("unit_access_invitation_unit_unresolved_idx")
			.on(table.unitId, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.resolution} is null`),
		index("unit_access_invitation_auth_user_unresolved_idx")
			.on(table.invitedAuthUserId, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.resolution} is null`),
		index("unit_access_invitation_unit_transfer_candidate_idx")
			.on(table.unitId, table.invitedAuthUserId)
			.where(
				sql`${table.resolution} = 'accepted'
					and ${table.accessExpiresAt} is null
					and cardinality(${table.scope}) = 0`,
			),
		index("unit_access_invitation_invited_by_idx").on(table.invitedByAuthUserId),
		index("unit_access_invitation_resolved_by_idx").on(table.resolvedByAuthUserId),
		check("unit_access_invitation_scope_check", scopeCheck(table.scope)),
		check(
			"unit_access_invitation_permissions_check",
			sql`cardinality(${table.permissions}) between 1 and ${DelegableUnitPermissionValues.length}
				and array_position(${table.permissions}, 'unit.ownership.transfer'::unit_permission) is null
				and array_position(${table.permissions}, 'unit.delete'::unit_permission) is null`,
		),
		check(
			"unit_access_invitation_accounts_differ_check",
			sql`${table.invitedAuthUserId} <> ${table.invitedByAuthUserId}`,
		),
		check(
			"unit_access_invitation_expiry_check",
			sql`${table.expiresAt} > ${table.createdAt} and (${table.accessExpiresAt} is null or ${table.accessExpiresAt} > ${table.createdAt})`,
		),
		check(
			"unit_access_invitation_resolution_shape_check",
			sql`(
				${table.resolution} is null and ${table.resolvedAt} is null and ${table.resolvedByAuthUserId} is null
			) or (
				${table.resolution} is not null and ${table.resolvedAt} is not null and ${table.resolvedByAuthUserId} is not null
			)`,
		),
	],
);

/** Profile and active Realm-member deny rules override every non-platform grant. */
export const unitAccessRestriction = pgTable(
	"unit_access_restriction",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid().notNull(),
		subjectKind: unitAccessRestrictionSubjectKind().notNull(),
		authUserId: uuid().references(() => users.id, { onDelete: "cascade" }),
		realmId: uuid().references(() => realm.id, { onDelete: "cascade" }),
		realmRelation: realmAccessSubjectRelation().$type<RealmAccessSubjectRelation>(),
		permission: unitPermission().$type<DelegableUnitPermission>().notNull(),
		scope: text().array().default(sql`array[]::text[]`).notNull(),
		decisionId: uuid().references(() => governanceDecision.id, { onDelete: "restrict" }),
		createdByAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		expiresAt: createTimestampMsColumn(),
		revokedAt: createTimestampMsColumn(),
		revokedByAuthUserId: uuid().references(() => users.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),

		...unitReferenceColumns("unit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("unit_access_restriction", "unit", table, false, table.unitId),

		index("unit_access_restriction_impact_idx").on(table.unitId, table.id).where(sql`${table.revokedAt} is null`),
		uniqueIndex("unit_access_restriction_active_auth_user_scope_key")
			.on(table.unitId, table.authUserId, table.permission, table.scope)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'auth'`),
		uniqueIndex("unit_access_restriction_active_realm_scope_key")
			.on(table.unitId, table.realmId, table.realmRelation, table.permission, table.scope)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'realm'`),
		index("unit_access_restriction_auth_user_active_idx")
			.on(table.authUserId, table.unitId, table.permission)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'auth'`),
		index("unit_access_restriction_realm_active_idx")
			.on(table.realmId, table.unitId, table.permission)
			.where(sql`${table.revokedAt} is null and ${table.subjectKind} = 'realm'`),
		index("unit_access_restriction_created_by_idx").on(table.createdByAuthUserId),
		index("unit_access_restriction_decision_idx")
			.on(table.decisionId)
			.where(sql`${table.decisionId} is not null`),
		check(
			"unit_access_restriction_subject_shape_check",
			sql`(
				${table.subjectKind} = 'auth' and ${table.authUserId} is not null and ${table.realmId} is null and ${table.realmRelation} is null
			) or (
				${table.subjectKind} = 'realm' and ${table.authUserId} is null and ${table.realmId} is not null and ${table.realmRelation} is not null
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
			sql`(${table.revokedAt} is null) = (${table.revokedByAuthUserId} is null)`,
		),
	],
);
