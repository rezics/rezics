import { and, eq, inArray, or, sql } from "drizzle-orm";
import { bigint, boolean, check, foreignKey, index, integer, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { AccessPermissionValues, AccessManagementPermissionValues, UnitPermissionValues, PlatformCapabilityValues, type AccessPermission } from "@rezics/access";
import { pgTable } from "./base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { accessScope, accessSubject } from "./access-identity";
import { accessRole } from "./access-role";
import { accessRoleBinding, accessRoleBindingRevision, accessRoleBindingScope } from "./access-role-binding";
import { accessGroup } from "./access-group";
import { users } from "./auth";

/** Resource-authority approval limiting one exact manager binding; it grants no data permission. @internal */
export const accessAssignmentCeiling = pgTable("access_assignment_ceiling", {
	id: createUuidv7PrimaryKey(),
	scopeId: uuid().notNull().references(() => accessRoleBindingScope.scopeId, { onDelete: "restrict" }),
	managerBindingId: uuid().notNull().references(() => accessRoleBinding.id, { onDelete: "restrict" }),
	managerTermsRevision: bigint({ mode: "number" }).notNull(),
	roleId: uuid().notNull().references(() => accessRole.id, { onDelete: "restrict" }),
	targetPath: text().array().notNull(),
	recipientKind: text().$type<"subject" | "group" | "all-members" | "scope-members">().notNull(),
	recipientSubjectId: uuid().references(() => accessSubject.id, { onDelete: "restrict" }),
	recipientGroupId: uuid(),
	recipientScopeId: uuid().references(() => accessScope.id, { onDelete: "restrict" }),
	memberSubjectKind: text().$type<"principal" | "entity">(),
	validFrom: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
	validUntil: timestamp({ withTimezone: true, precision: 3, mode: "date" }),
	maximumGrantDurationSeconds: integer(),
	grantNotAfter: timestamp({ withTimezone: true, precision: 3, mode: "date" }),
	permissionCount: integer().notNull(),
	permissionDigest: text().notNull(),
	sealed: boolean().notNull().default(false),
	version: bigint({ mode: "number" }).notNull().default(0),
	state: text().$type<"draft" | "active" | "revoked">().notNull().default("draft"),
}, table => [
	foreignKey({ name: "access_assignment_ceiling_manager_terms_fk", columns: [table.managerBindingId, table.managerTermsRevision], foreignColumns: [accessRoleBindingRevision.bindingId, accessRoleBindingRevision.revision] }).onDelete("restrict"),
	foreignKey({ name: "access_assignment_ceiling_group_fk", columns: [table.recipientGroupId, table.recipientScopeId], foreignColumns: [accessGroup.id, accessGroup.scopeId] }).onDelete("restrict"),
	index("access_assignment_ceiling_binding_page_idx").on(table.managerBindingId, table.id),
	index("access_assignment_ceiling_manager_idx").on(table.scopeId, table.managerBindingId, table.roleId, table.id),
	index("access_assignment_ceiling_role_idx").on(table.roleId, table.scopeId, table.id),
	index("access_assignment_ceiling_subject_idx").on(table.recipientSubjectId, table.id).where(sql`${table.recipientSubjectId} is not null`),
	index("access_assignment_ceiling_group_idx").on(table.recipientGroupId, table.id).where(sql`${table.recipientGroupId} is not null`),
	index("access_assignment_ceiling_recipient_scope_idx").on(table.recipientScopeId, table.id).where(sql`${table.recipientScopeId} is not null`),
	check("access_assignment_ceiling_version_check", sql`${table.version} between 0 and 2 and ${table.managerTermsRevision} between 1 and 9007199254740991`),
	check("access_assignment_ceiling_state_check", sql`(${table.version}=0 and ${table.state}='draft' and not ${table.sealed}) or (${table.version}=1 and ${table.state}='active' and ${table.sealed}) or (${table.version}=2 and ${table.state}='revoked' and ${table.sealed})`),
	check("access_assignment_ceiling_recipient_check", sql`
		(${table.recipientKind}='subject' and ${table.recipientSubjectId} is not null and ${table.recipientGroupId} is null and ${table.recipientScopeId} is null and ${table.memberSubjectKind} is null)
		or (${table.recipientKind}='group' and ${table.recipientSubjectId} is null and ${table.recipientGroupId} is not null and ${table.recipientScopeId} is not null and ${table.memberSubjectKind} is null)
		or (${table.recipientKind}='all-members' and ${table.recipientSubjectId} is null and ${table.recipientGroupId} is null and ${table.recipientScopeId} is not null and ${table.memberSubjectKind} is null)
		or (${table.recipientKind}='scope-members' and ${table.recipientSubjectId} is null and ${table.recipientGroupId} is null and ${table.recipientScopeId} is not null and ${table.memberSubjectKind} is not null and ${table.memberSubjectKind} in ('principal','entity'))`),
	check("access_assignment_ceiling_path_check", sql`cardinality(${table.targetPath}) between 0 and 8 and coalesce(array_ndims(${table.targetPath}),1)=1 and array_position(${table.targetPath},null) is null`),
	check("access_assignment_ceiling_validity_check", sql`isfinite(${table.validFrom}) and (${table.validUntil} is null or (isfinite(${table.validUntil}) and ${table.validUntil}>${table.validFrom}))`),
	check("access_assignment_ceiling_grant_lifetime_check", sql`(${table.maximumGrantDurationSeconds} is null or ${table.maximumGrantDurationSeconds}>0) and (${table.grantNotAfter} is null or isfinite(${table.grantNotAfter}))`),
	check("access_assignment_ceiling_count_check", sql`${table.permissionCount} between 0 and ${sql.raw(String(AccessPermissionValues.length))}`),
	check("access_assignment_ceiling_digest_check", sql`${table.permissionDigest} ~ '^[0-9a-f]{64}$'`),
]);

/** Literal finite confer authority; the set is sealed with its immutable approval. @internal */
export const accessAssignmentCeilingPermission = pgTable("access_assignment_ceiling_permission", {
	ceilingId: uuid().notNull().references(() => accessAssignmentCeiling.id, { onDelete: "restrict" }),
	family: text().$type<AccessPermission["family"]>().notNull(),
	permission: text().notNull(),
}, table => [
	primaryKey({ columns: [table.ceilingId, table.family, table.permission] }),
	check("access_assignment_ceiling_permission_check", or(
		and(eq(table.family, "unit"), inArray(table.permission, UnitPermissionValues)),
		and(eq(table.family, "platform"), inArray(table.permission, PlatformCapabilityValues)),
		and(eq(table.family, "management"), inArray(table.permission, AccessManagementPermissionValues)),
	)!),
]);

/** Private create/revoke receipts; institutional approval ignores the issuer's later departure. @internal */
export const accessAssignmentCeilingEvent = pgTable("access_assignment_ceiling_event", {
	ceilingId: uuid().notNull().references(() => accessAssignmentCeiling.id, { onDelete: "restrict" }),
	version: bigint({ mode: "number" }).notNull(),
	operationId: uuid().notNull(), requestDigest: text().notNull(),
	operation: text().$type<"create" | "revoke">().notNull(),
	operatorAuthUserId: uuid().notNull().references(() => users.id, { onDelete: "restrict" }),
	authoritySubjectId: uuid().notNull().references(() => accessSubject.id, { onDelete: "restrict" }),
	createdAt: createCreatedAtColumn(),
}, table => [
	primaryKey({ columns: [table.ceilingId, table.version] }),
	uniqueIndex("access_assignment_ceiling_event_operation_key").on(table.ceilingId, table.operationId),
	check("access_assignment_ceiling_event_version_check", sql`(${table.operation}='create' and ${table.version}=1) or (${table.operation}='revoke' and ${table.version}=2)`),
	check("access_assignment_ceiling_event_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`),
]);
