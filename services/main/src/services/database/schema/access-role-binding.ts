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
import { accessRole } from "./access-role";
import { users } from "./auth";
import { accessMembershipAdmission } from "./access-membership";
import { accessGroupMembershipEvent } from "./access-group-membership";

/** Target-local serialization for binding intake and negative candidate reads. @internal */
export const accessRoleBindingScope = pgTable(
	"access_role_binding_scope",
	{
		scopeId: uuid()
			.primaryKey()
			.references(() => accessScope.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull().default(0),
	},
	(table) => [
		check(
			"access_role_binding_scope_version_check",
			sql`${table.version} between 0 and 9007199254740991`,
		),
	],
);

/** Immutable role/recipient/target identity; terms change through sealed revisions. @internal */
export const accessRoleBinding = pgTable(
	"access_role_binding",
	{
		id: createUuidv7PrimaryKey(),
		targetScopeId: uuid()
			.notNull()
			.references(() => accessRoleBindingScope.scopeId, { onDelete: "restrict" }),
		roleId: uuid()
			.notNull()
			.references(() => accessRole.id, { onDelete: "restrict" }),
		recipientKind: text().$type<"subject" | "group" | "all-members">().notNull(),
		recipientSubjectId: uuid().references(() => accessSubject.id, { onDelete: "restrict" }),
		recipientGroupId: uuid(),
		recipientScopeId: uuid().references(() => accessScope.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull().default(0),
		termsRevision: bigint({ mode: "number" }),
		state: text().$type<"draft" | "active" | "revoked">().notNull().default("draft"),
	},
	(table): PgTableExtraConfigValue[] => [
		foreignKey({
			name: "access_role_binding_group_scope_fk",
			columns: [table.recipientGroupId, table.recipientScopeId],
			foreignColumns: [accessGroup.id, accessGroup.scopeId],
		}).onDelete("restrict"),
		foreignKey({
			name: "access_role_binding_terms_fk",
			columns: [table.id, table.termsRevision],
			foreignColumns: [accessRoleBindingRevision.bindingId, accessRoleBindingRevision.revision],
		}).onDelete("restrict"),
		index("access_role_binding_target_idx").on(table.targetScopeId, table.id),
		index("access_role_binding_role_idx").on(table.roleId, table.targetScopeId, table.id),
		index("access_role_binding_subject_idx")
			.on(table.recipientSubjectId, table.targetScopeId, table.id)
			.where(sql`${table.recipientSubjectId} is not null`),
		index("access_role_binding_group_idx")
			.on(table.recipientGroupId, table.targetScopeId, table.id)
			.where(sql`${table.recipientGroupId} is not null`),
		index("access_role_binding_members_idx")
			.on(table.recipientScopeId, table.targetScopeId, table.id)
			.where(sql`${table.recipientKind}='all-members'`),
		check(
			"access_role_binding_version_check",
			sql`${table.version} between 0 and 9007199254740991 and (${table.termsRevision} is null or ${table.termsRevision} between 1 and ${table.version})`,
		),
		check(
			"access_role_binding_state_check",
			sql`(${table.state}='draft' and ${table.termsRevision} is null) or (${table.state} in ('active','revoked') and ${table.termsRevision} is not null)`,
		),
		check(
			"access_role_binding_recipient_check",
			sql`(${table.recipientKind}='subject' and ${table.recipientSubjectId} is not null and ${table.recipientGroupId} is null and ${table.recipientScopeId} is null) or (${table.recipientKind}='group' and ${table.recipientSubjectId} is null and ${table.recipientGroupId} is not null and ${table.recipientScopeId} is not null) or (${table.recipientKind}='all-members' and ${table.recipientSubjectId} is null and ${table.recipientGroupId} is null and ${table.recipientScopeId} is not null)`,
		),
	],
);

/** Private control receipt. A revoke selects prior terms; create/amend terms use the event's own version. @internal */
export const accessRoleBindingEvent = pgTable(
	"access_role_binding_event",
	{
		bindingId: uuid()
			.notNull()
			.references(() => accessRoleBinding.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull(),
		operationId: uuid().notNull(),
		requestDigest: text().notNull(),
		operation: text().$type<"create" | "amend" | "revoke">().notNull(),
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
		primaryKey({ columns: [table.bindingId, table.version] }),
		uniqueIndex("access_role_binding_event_operation_key").on(table.bindingId, table.operationId),
		foreignKey({
			name: "access_role_binding_event_retained_terms_fk",
			columns: [table.bindingId, table.retainedTermsRevision],
			foreignColumns: [accessRoleBindingRevision.bindingId, accessRoleBindingRevision.revision],
		}).onDelete("restrict"),
		check(
			"access_role_binding_event_version_check",
			sql`${table.version} between 1 and 9007199254740991`,
		),
		check("access_role_binding_event_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`),
		check(
			"access_role_binding_event_operation_check",
			sql`(${table.operation} in ('create','amend') and ${table.retainedTermsRevision} is null) or (${table.operation}='revoke' and ${table.retainedTermsRevision} is not null and ${table.retainedTermsRevision}<${table.version})`,
		),
	],
);

/** Sealed target-path, validity, exact recipient eligibility and permission policy. @internal */
export const accessRoleBindingRevision = pgTable(
	"access_role_binding_revision",
	{
		bindingId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		targetPath: text().array().notNull(),
		validFrom: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
		validUntil: timestamp({ withTimezone: true, precision: 3, mode: "date" }),
		permissionPolicy: text().$type<"local-role" | "frozen-ceiling">().notNull(),
		permissionCount: integer().notNull(),
		permissionDigest: text().notNull(),
		membershipId: uuid(),
		membershipGeneration: bigint({ mode: "number" }),
		selectionGroupId: uuid(),
		selectionVersion: bigint({ mode: "number" }),
		sealed: boolean().notNull().default(false),
	},
	(table) => [
		primaryKey({ columns: [table.bindingId, table.revision] }),
		foreignKey({
			name: "access_role_binding_revision_admission_fk",
			columns: [table.membershipId, table.membershipGeneration],
			foreignColumns: [accessMembershipAdmission.membershipId, accessMembershipAdmission.generation],
		}).onDelete("restrict"),
		foreignKey({
			name: "access_role_binding_revision_selection_fk",
			columns: [table.membershipId, table.membershipGeneration, table.selectionGroupId, table.selectionVersion],
			foreignColumns: [accessGroupMembershipEvent.membershipId, accessGroupMembershipEvent.generation, accessGroupMembershipEvent.groupId, accessGroupMembershipEvent.version],
		}).onDelete("restrict"),
		index("access_role_binding_revision_admission_idx")
			.on(table.membershipId, table.membershipGeneration, table.bindingId, table.revision)
			.where(sql`${table.membershipId} is not null`),
		check(
			"access_role_binding_revision_eligibility_check",
			sql`((${table.membershipId} is null and ${table.membershipGeneration} is null and ${table.selectionGroupId} is null and ${table.selectionVersion} is null) or (${table.membershipId} is not null and ${table.membershipGeneration} between 1 and 9007199254740991 and ((${table.selectionGroupId} is null and ${table.selectionVersion} is null) or (${table.selectionGroupId} is not null and ${table.selectionVersion} between 1 and 9007199254740991)))) and (${table.membershipId} is null)=(${table.membershipGeneration} is null) and (${table.selectionGroupId} is null)=(${table.selectionVersion} is null)`,
		),
		foreignKey({
			name: "access_role_binding_revision_event_fk",
			columns: [table.bindingId, table.revision],
			foreignColumns: [accessRoleBindingEvent.bindingId, accessRoleBindingEvent.version],
		}).onDelete("restrict"),
		check(
			"access_role_binding_revision_path_check",
			sql`cardinality(${table.targetPath}) between 0 and 8 and coalesce(array_ndims(${table.targetPath}),1)=1 and array_position(${table.targetPath},null) is null`,
		),
		check(
			"access_role_binding_revision_validity_check",
			sql`isfinite(${table.validFrom}) and (${table.validUntil} is null or (isfinite(${table.validUntil}) and ${table.validUntil}>${table.validFrom}))`,
		),
		check(
			"access_role_binding_revision_policy_check",
			inArray(table.permissionPolicy, ["local-role", "frozen-ceiling"]),
		),
		check(
			"access_role_binding_revision_count_check",
			sql`${table.permissionCount} between 0 and ${sql.raw(String(AccessPermissionValues.length))} and (${table.permissionPolicy}<>'local-role' or ${table.permissionCount}=0)`,
		),
		check(
			"access_role_binding_revision_digest_check",
			sql`${table.permissionDigest} ~ '^[0-9a-f]{64}$'`,
		),
	],
);

/** Literal resource-authority approval members; loading must never expand this stored set. @internal */
export const accessRoleBindingPermission = pgTable(
	"access_role_binding_permission",
	{
		bindingId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		family: text().$type<AccessPermission["family"]>().notNull(),
		permission: text().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.bindingId, table.revision, table.family, table.permission] }),
		foreignKey({
			name: "access_role_binding_permission_revision_fk",
			columns: [table.bindingId, table.revision],
			foreignColumns: [accessRoleBindingRevision.bindingId, accessRoleBindingRevision.revision],
		}).onDelete("restrict"),
		check(
			"access_role_binding_permission_known_check",
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
