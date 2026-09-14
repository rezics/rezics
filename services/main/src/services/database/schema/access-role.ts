import { and, or, inArray, sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	text,
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
import { users } from "./auth";
import { accessScope, accessSubject } from "./access-identity";

/** Scoped role identity and current activation; definitions and receipts remain immutable. @internal */
export const accessRole = pgTable(
	"access_role",
	{
		id: createUuidv7PrimaryKey(),
		scopeId: uuid()
			.notNull()
			.references(() => accessScope.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull().default(0),
		activeRevision: bigint({ mode: "number" }),
		state: text().$type<"draft" | "active" | "retired">().notNull().default("draft"),
	},
	(table): PgTableExtraConfigValue[] => [
		index("access_role_scope_idx").on(table.scopeId, table.id),
		foreignKey({
			name: "access_role_active_revision_fk",
			columns: [table.id, table.activeRevision],
			foreignColumns: [accessRoleRevision.roleId, accessRoleRevision.revision],
		}).onDelete("restrict"),
		check(
			"access_role_version_check",
			sql`${table.version} between 0 and 9007199254740991 and (${table.activeRevision} is null or ${table.activeRevision} between 1 and ${table.version})`,
		),
		check(
			"access_role_state_check",
			sql`${table.state} in ('draft','active','retired') and (${table.state}<>'draft' or ${table.activeRevision} is null) and (${table.state}<>'active' or ${table.activeRevision} is not null)`,
		),
	],
);

/** Private command receipt; actor provenance does not grant authority over the role. @internal */
export const accessRoleEvent = pgTable(
	"access_role_event",
	{
		roleId: uuid()
			.notNull()
			.references(() => accessRole.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull(),
		operationId: uuid().notNull(),
		requestDigest: text().notNull(),
		operation: text().$type<"create" | "revise" | "activate" | "retire">().notNull(),
		stateAfter: text().$type<"draft" | "active" | "retired">().notNull(),
		activeRevision: bigint({ mode: "number" }),
		operatorAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		authoritySubjectId: uuid()
			.notNull()
			.references(() => accessSubject.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table): PgTableExtraConfigValue[] => [
		primaryKey({ columns: [table.roleId, table.version] }),
		uniqueIndex("access_role_event_operation_key").on(table.roleId, table.operationId),
		foreignKey({
			name: "access_role_event_active_revision_fk",
			columns: [table.roleId, table.activeRevision],
			foreignColumns: [accessRoleRevision.roleId, accessRoleRevision.revision],
		}).onDelete("restrict"),
		check("access_role_event_version_check", sql`${table.version} between 1 and 9007199254740991`),
		check("access_role_event_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`),
		check(
			"access_role_event_operation_check",
			inArray(table.operation, ["create", "revise", "activate", "retire"]),
		),
		check(
			"access_role_event_state_check",
			inArray(table.stateAfter, ["draft", "active", "retired"]),
		),
	],
);

/** Complete, sealed permission snapshot. Unsealed rows may exist only inside the creating transaction. @internal */
export const accessRoleRevision = pgTable(
	"access_role_revision",
	{
		roleId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		label: text().notNull(),
		description: text(),
		permissionCount: integer().notNull(),
		permissionDigest: text().notNull(),
		sealed: boolean().notNull().default(false),
	},
	(table): PgTableExtraConfigValue[] => [
		primaryKey({ columns: [table.roleId, table.revision] }),
		foreignKey({
			name: "access_role_revision_event_fk",
			columns: [table.roleId, table.revision],
			foreignColumns: [accessRoleEvent.roleId, accessRoleEvent.version],
		}).onDelete("restrict"),
		check(
			"access_role_revision_label_check",
			sql`length(btrim(${table.label})) > 0 and octet_length(${table.label}) <= 512`,
		),
		check(
			"access_role_revision_description_check",
			sql`${table.description} is null or octet_length(${table.description}) <= 4096`,
		),
		check(
			"access_role_revision_count_check",
			sql`${table.permissionCount} between 0 and ${sql.raw(String(AccessPermissionValues.length))}`,
		),
		check("access_role_revision_digest_check", sql`${table.permissionDigest} ~ '^[0-9a-f]{64}$'`),
	],
);

/** Explicit permission membership in one immutable role definition. @internal */
export const accessRolePermission = pgTable(
	"access_role_permission",
	{
		roleId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		family: text().$type<AccessPermission["family"]>().notNull(),
		permission: text().$type<AccessPermission["key"]>().notNull(),
	},
	(table): PgTableExtraConfigValue[] => [
		primaryKey({ columns: [table.roleId, table.revision, table.family, table.permission] }),
		foreignKey({
			name: "access_role_permission_revision_fk",
			columns: [table.roleId, table.revision],
			foreignColumns: [accessRoleRevision.roleId, accessRoleRevision.revision],
		}).onDelete("restrict"),
		check(
			"access_role_permission_registered_check",
			or(
				and(sql`${table.family}='unit'`, inArray(table.permission, UnitPermissionValues)),
				and(sql`${table.family}='platform'`, inArray(table.permission, PlatformCapabilityValues)),
				and(
					sql`${table.family}='management'`,
					inArray(table.permission, AccessManagementPermissionValues),
				),
			)!,
		),
	],
);
