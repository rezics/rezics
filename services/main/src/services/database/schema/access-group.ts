import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	primaryKey,
	smallint,
	text,
	uniqueIndex,
	uuid,
	type PgTableExtraConfigValue,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { users } from "./auth";
import { accessScope, accessSubject } from "./access-identity";

/** Scope-local topology serialization and reader fence; not a roster or authorization result. @internal */
export const accessGroupTree = pgTable(
	"access_group_tree",
	{
		scopeId: uuid()
			.primaryKey()
			.references(() => accessScope.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull().default(0),
	},
	(table) => [
		check("access_group_tree_version_check", sql`${table.version} between 0 and 9007199254740991`),
	],
);

/** Narrow Group identity and current topology; derived height bounds moves without descendant expansion. @internal */
export const accessGroup = pgTable(
	"access_group",
	{
		id: createUuidv7PrimaryKey(),
		scopeId: uuid()
			.notNull()
			.references(() => accessGroupTree.scopeId, { onDelete: "restrict" }),
		parentId: uuid(),
		version: bigint({ mode: "number" }).notNull().default(0),
		state: text().$type<"draft" | "active" | "retired">().notNull().default("draft"),
		subtreeHeight: smallint().notNull().default(1),
	},
	(table): PgTableExtraConfigValue[] => [
		uniqueIndex("access_group_id_scope_key").on(table.id, table.scopeId),
		index("access_group_scope_id_idx").on(table.scopeId, table.id),
		index("access_group_parent_height_idx")
			.on(table.scopeId, table.parentId, table.subtreeHeight.desc(), table.id)
			.where(sql`${table.state}='active'`),
		foreignKey({
			name: "access_group_parent_scope_fk",
			columns: [table.parentId, table.scopeId],
			foreignColumns: [accessGroup.id, accessGroup.scopeId],
		}).onDelete("restrict"),
		check("access_group_version_check", sql`${table.version} between 0 and 9007199254740991`),
		check("access_group_state_check", inArray(table.state, ["draft", "active", "retired"])),
		check("access_group_height_check", sql`${table.subtreeHeight} between 1 and 8`),
		check(
			"access_group_parent_check",
			sql`${table.parentId} is null or ${table.parentId}<>${table.id}`,
		),
	],
);

/** Immutable control and presentation snapshot for a Group transition. @internal */
export const accessGroupEvent = pgTable(
	"access_group_event",
	{
		groupId: uuid()
			.notNull()
			.references(() => accessGroup.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull(),
		operationId: uuid().notNull(),
		requestDigest: text().notNull(),
		operation: text().$type<"create" | "update" | "reparent" | "retire">().notNull(),
		stateAfter: text().$type<"active" | "retired">().notNull(),
		parentAfterId: uuid().references(() => accessGroup.id, { onDelete: "restrict" }),
		label: text().notNull(),
		description: text(),
		operatorAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		authoritySubjectId: uuid()
			.notNull()
			.references(() => accessSubject.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.groupId, table.version] }),
		uniqueIndex("access_group_event_operation_key").on(table.groupId, table.operationId),
		check("access_group_event_version_check", sql`${table.version} between 1 and 9007199254740991`),
		check("access_group_event_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`),
		check(
			"access_group_event_operation_check",
			inArray(table.operation, ["create", "update", "reparent", "retire"]),
		),
		check(
			"access_group_event_state_check",
			sql`(${table.operation}='retire' and ${table.stateAfter}='retired') or (${table.operation}<>'retire' and ${table.stateAfter}='active')`,
		),
		check(
			"access_group_event_label_check",
			sql`length(btrim(${table.label}))>0 and octet_length(${table.label})<=512`,
		),
		check(
			"access_group_event_description_check",
			sql`${table.description} is null or octet_length(${table.description})<=4096`,
		),
	],
);
