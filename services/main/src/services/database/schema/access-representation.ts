import { and, or, eq, inArray, sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	type PgTableExtraConfigValue,
} from "drizzle-orm/pg-core";
import {
	AccessPermissionValues,
	AccessManagementPermissionValues,
	UnitPermissionValues,
	PlatformCapabilityValues,
	type AccessPermission,
} from "@rezics/access";
import { pgTable } from "./base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { accessScope, accessSubject } from "./access-identity";
import { accessGroup } from "./access-group";
import { entityIdentity } from "./catalog-identity";
import { users } from "./auth";
import { accessMembershipAdmission } from "./access-membership";
import { accessGroupMembershipEvent } from "./access-group-membership";

/** Entity-local serialization for representation intake, control and negative reads. @internal */
export const accessRepresentationEntity = pgTable(
	"access_representation_entity",
	{
		entityId: uuid()
			.primaryKey()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull().default(0),
	},
	(table) => [
		check(
			"access_representation_entity_version_check",
			sql`${table.version} between 0 and 9007199254740991`,
		),
	],
);

/** Immutable represented Entity, delegate and parent lineage; current target mirrors sealed narrowing terms. @internal */
export const accessRepresentation = pgTable(
	"access_representation",
	{
		id: createUuidv7PrimaryKey(),
		entityId: uuid().notNull().references(() => accessRepresentationEntity.entityId, { onDelete: "restrict" }),
		targetKind: text().$type<"all-scopes" | "scope">().notNull().default("scope"),
		targetScopeId: uuid().references(() => accessScope.id, { onDelete: "restrict" }),
		parentGrantId: uuid(),
		parentRevision: bigint({ mode: "number" }),
		parentSubjectId: uuid().references(() => accessSubject.id, { onDelete: "restrict" }),
		parentMembershipId: uuid(),
		parentMembershipGeneration: bigint({ mode: "number" }),
		parentSelectionGroupId: uuid(),
		parentSelectionVersion: bigint({ mode: "number" }),
		recipientKind: text().$type<"subject" | "group" | "all-members">().notNull(),
		recipientSubjectId: uuid().references(() => accessSubject.id, { onDelete: "restrict" }),
		recipientGroupId: uuid(),
		recipientScopeId: uuid().references(() => accessScope.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull().default(0),
		termsRevision: bigint({ mode: "number" }),
		state: text().$type<"draft" | "active" | "revoked">().notNull().default("draft"),
	},
	(table): PgTableExtraConfigValue[] => [
		check("access_representation_target_check", sql`(${table.targetKind}='all-scopes' and ${table.targetScopeId} is null) or (${table.targetKind}='scope' and ${table.targetScopeId} is not null)`),
		foreignKey({
			name: "access_representation_group_scope_fk",
			columns: [table.recipientGroupId, table.recipientScopeId],
			foreignColumns: [accessGroup.id, accessGroup.scopeId],
		}).onDelete("restrict"),
		foreignKey({
			name: "access_representation_terms_fk",
			columns: [table.id, table.termsRevision],
			foreignColumns: [accessRepresentationRevision.grantId, accessRepresentationRevision.revision],
		}).onDelete("restrict"),
		foreignKey({
			name: "access_representation_parent_fk",
			columns: [table.parentGrantId, table.parentRevision],
			foreignColumns: [accessRepresentationRevision.grantId, accessRepresentationRevision.revision],
		}).onDelete("restrict"),
		foreignKey({
			name: "access_representation_parent_admission_fk",
			columns: [table.parentMembershipId, table.parentMembershipGeneration],
			foreignColumns: [accessMembershipAdmission.membershipId, accessMembershipAdmission.generation],
		}).onDelete("restrict"),
		foreignKey({
			name: "access_representation_parent_selection_fk",
			columns: [table.parentMembershipId, table.parentMembershipGeneration, table.parentSelectionGroupId, table.parentSelectionVersion],
			foreignColumns: [accessGroupMembershipEvent.membershipId, accessGroupMembershipEvent.generation, accessGroupMembershipEvent.groupId, accessGroupMembershipEvent.version],
		}).onDelete("restrict"),
		check("access_representation_parent_basis_check", sql`
			(${table.parentGrantId} is null)=(${table.parentSubjectId} is null)
			and (${table.parentMembershipId} is null)=(${table.parentMembershipGeneration} is null)
			and (${table.parentSelectionGroupId} is null)=(${table.parentSelectionVersion} is null)
			and (${table.parentMembershipId} is null or (${table.parentSubjectId} is not null and ${table.parentMembershipGeneration} between 1 and 9007199254740991))
			and (${table.parentSelectionGroupId} is null or (${table.parentMembershipId} is not null and ${table.parentSelectionVersion} between 1 and 9007199254740991))`),
		index("access_representation_group_page_idx").on(table.recipientGroupId, table.id).where(sql`${table.recipientGroupId} is not null`),
		index("access_representation_child_page_idx").on(table.parentGrantId, table.id).where(sql`${table.parentGrantId} is not null`),
		index("access_representation_parent_selection_page_idx").on(table.parentSelectionGroupId, table.id).where(sql`${table.parentSelectionGroupId} is not null`),
		index("access_representation_parent_subject_idx").on(table.parentSubjectId, table.id).where(sql`${table.parentSubjectId} is not null`),
		index("access_representation_parent_admission_idx").on(table.parentMembershipId, table.parentMembershipGeneration, table.id).where(sql`${table.parentMembershipId} is not null`),
		check("access_representation_parent_check", sql`(${table.parentGrantId} is null and ${table.parentRevision} is null) or (${table.parentGrantId} is not null and ${table.parentGrantId}<>${table.id} and ${table.parentRevision} is not null and ${table.parentRevision} between 1 and 9007199254740991)`),
		index("access_representation_active_controller_idx").on(table.entityId,table.id).where(sql`${table.state}='active'`),
		index("access_representation_entity_idx").on(table.entityId, table.targetScopeId, table.id),
		index("access_representation_target_idx").on(table.targetScopeId, table.entityId, table.id),
		index("access_representation_recipient_scope_page_idx").on(table.recipientScopeId, table.id).where(sql`${table.recipientScopeId} is not null`),
		index("access_representation_recipient_scope_idx")
			.on(table.targetScopeId, table.recipientScopeId, table.id)
			.where(sql`${table.state}='active' and ${table.recipientScopeId} is not null`),
		index("access_representation_parent_idx").on(table.parentGrantId, table.parentRevision, table.id).where(sql`${table.parentGrantId} is not null`),
		index("access_representation_subject_page_idx").on(table.recipientSubjectId,table.id).where(sql`${table.recipientSubjectId} is not null`),
		index("access_representation_subject_idx")
			.on(table.recipientSubjectId, table.targetScopeId, table.id)
			.where(sql`${table.recipientSubjectId} is not null`),
		index("access_representation_group_idx")
			.on(table.recipientGroupId, table.targetScopeId, table.id)
			.where(sql`${table.recipientGroupId} is not null`),
		index("access_representation_members_idx")
			.on(table.recipientScopeId, table.targetScopeId, table.id)
			.where(sql`${table.recipientKind}='all-members'`),
		check(
			"access_representation_version_check",
			sql`${table.version} between 0 and 9007199254740991 and (${table.termsRevision} is null or ${table.termsRevision} between 1 and ${table.version})`,
		),
		check(
			"access_representation_state_check",
			sql`(${table.state}='draft' and ${table.termsRevision} is null) or (${table.state} in ('active','revoked') and ${table.termsRevision} is not null)`,
		),
		check(
			"access_representation_recipient_check",
			sql`(${table.recipientKind}='subject' and ${table.recipientSubjectId} is not null and ${table.recipientGroupId} is null and ${table.recipientScopeId} is null) or (${table.recipientKind}='group' and ${table.recipientSubjectId} is null and ${table.recipientGroupId} is not null and ${table.recipientScopeId} is not null) or (${table.recipientKind}='all-members' and ${table.recipientSubjectId} is null and ${table.recipientGroupId} is null and ${table.recipientScopeId} is not null)`,
		),
	],
);

/** Private control receipt. Revoke retains prior terms; create/narrow terms use their own version. @internal */
export const accessRepresentationEvent = pgTable(
	"access_representation_event",
	{
		grantId: uuid()
			.notNull()
			.references(() => accessRepresentation.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull(),
		operationId: uuid().notNull(),
		requestDigest: text().notNull(),
		operation: text().$type<"create" | "narrow" | "revoke">().notNull(),
		retainedTermsRevision: bigint({ mode: "number" }),
		operatorAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		authoritySubjectId: uuid()
			.notNull()
			.references(() => accessSubject.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table): PgTableExtraConfigValue[] => [
		primaryKey({ columns: [table.grantId, table.version] }),
		uniqueIndex("access_representation_event_operation_key").on(table.grantId, table.operationId),
		foreignKey({
			name: "access_representation_event_retained_terms_fk",
			columns: [table.grantId, table.retainedTermsRevision],
			foreignColumns: [accessRepresentationRevision.grantId, accessRepresentationRevision.revision],
		}).onDelete("restrict"),
		check(
			"access_representation_event_version_check",
			sql`${table.version} between 1 and 9007199254740991`,
		),
		check("access_representation_event_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`),
		check(
			"access_representation_event_operation_check",
			sql`(${table.operation} in ('create','narrow') and ${table.retainedTermsRevision} is null) or (${table.operation}='revoke' and ${table.retainedTermsRevision} is not null and ${table.retainedTermsRevision}<${table.version})`,
		),
	],
);

/** Sealed action/resource ceiling, redelegation limit and exact delegate eligibility. @internal */
export const accessRepresentationRevision = pgTable(
	"access_representation_revision",
	{
		grantId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		targetKind: text().$type<"all-scopes" | "scope">().notNull().default("scope"),
		targetScopeId: uuid().references(() => accessScope.id, { onDelete: "restrict" }),
		targetPath: text().array().notNull(),
		validFrom: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
		validUntil: timestamp({ withTimezone: true, precision: 3, mode: "date" }),
		canRedelegate: boolean().notNull(),
		requireFreshSession: boolean().notNull(),
		permissionCount: integer().notNull(),
		permissionDigest: text().notNull(),
		membershipId: uuid(),
		membershipGeneration: bigint({ mode: "number" }),
		selectionGroupId: uuid(),
		selectionVersion: bigint({ mode: "number" }),
		sealed: boolean().notNull().default(false),
	},
	(table) => [
		primaryKey({ columns: [table.grantId, table.revision] }),
		check("access_representation_revision_target_check", sql`(${table.targetKind}='all-scopes' and ${table.targetScopeId} is null and cardinality(${table.targetPath})=0) or (${table.targetKind}='scope' and ${table.targetScopeId} is not null)`),
		foreignKey({
			name: "access_representation_revision_admission_fk",
			columns: [table.membershipId, table.membershipGeneration],
			foreignColumns: [accessMembershipAdmission.membershipId, accessMembershipAdmission.generation],
		}).onDelete("restrict"),
		foreignKey({
			name: "access_representation_revision_selection_fk",
			columns: [table.membershipId, table.membershipGeneration, table.selectionGroupId, table.selectionVersion],
			foreignColumns: [accessGroupMembershipEvent.membershipId, accessGroupMembershipEvent.generation, accessGroupMembershipEvent.groupId, accessGroupMembershipEvent.version],
		}).onDelete("restrict"),
		index("access_representation_selection_page_idx").on(table.selectionGroupId, table.grantId, table.revision).where(sql`${table.selectionGroupId} is not null`),
		index("access_representation_revision_admission_idx")
			.on(table.membershipId, table.membershipGeneration, table.grantId, table.revision)
			.where(sql`${table.membershipId} is not null`),
		check(
			"access_representation_revision_eligibility_check",
			sql`((${table.membershipId} is null and ${table.membershipGeneration} is null and ${table.selectionGroupId} is null and ${table.selectionVersion} is null) or (${table.membershipId} is not null and ${table.membershipGeneration} between 1 and 9007199254740991 and ((${table.selectionGroupId} is null and ${table.selectionVersion} is null) or (${table.selectionGroupId} is not null and ${table.selectionVersion} between 1 and 9007199254740991)))) and (${table.membershipId} is null)=(${table.membershipGeneration} is null) and (${table.selectionGroupId} is null)=(${table.selectionVersion} is null)`,
		),
		foreignKey({
			name: "access_representation_revision_event_fk",
			columns: [table.grantId, table.revision],
			foreignColumns: [accessRepresentationEvent.grantId, accessRepresentationEvent.version],
		}).onDelete("restrict"),
		check(
			"access_representation_revision_path_check",
			sql`cardinality(${table.targetPath}) between 0 and 8 and coalesce(array_ndims(${table.targetPath}),1)=1 and array_position(${table.targetPath},null) is null`,
		),
		check(
			"access_representation_revision_validity_check",
			sql`isfinite(${table.validFrom}) and (${table.validUntil} is null or (isfinite(${table.validUntil}) and ${table.validUntil}>${table.validFrom}))`,
		),
		check(
			"access_representation_revision_count_check",
			sql`${table.permissionCount} between 0 and ${sql.raw(String(AccessPermissionValues.length))}`,
		),
		check(
			"access_representation_revision_digest_check",
			sql`${table.permissionDigest} ~ '^[0-9a-f]{64}$'`,
		),
	],
);

/** Literal representation permission approval; current use never expands this snapshot. @internal */
export const accessRepresentationPermission = pgTable(
	"access_representation_permission",
	{
		grantId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		family: text().$type<AccessPermission["family"]>().notNull(),
		permission: text().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.grantId, table.revision, table.family, table.permission] }),
		foreignKey({
			name: "access_representation_permission_revision_fk",
			columns: [table.grantId, table.revision],
			foreignColumns: [accessRepresentationRevision.grantId, accessRepresentationRevision.revision],
		}).onDelete("restrict"),
		check(
			"access_representation_permission_known_check",
			or(
				and(eq(table.family, "unit"), inArray(table.permission, UnitPermissionValues)),
				and(eq(table.family, "platform"), inArray(table.permission, PlatformCapabilityValues)),
				and(
					eq(table.family, "management"),
					inArray(table.permission, AccessManagementPermissionValues),
				),
			)!,
		),
	],
);
