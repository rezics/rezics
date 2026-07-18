import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	doublePrecision,
	foreignKey,
	index,
	integer,
	pgEnum,
	primaryKey,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { ProgressStatusValues, toEnumValues } from "./contract-values";
import { createCreatedAtColumn, createTimestampMsColumn, createUpdatedAtColumn } from "./columns";
import { contentStructureNode } from "./content-structure";
import { profile, unit } from "./core";

export const progressStatus = pgEnum("progress_status", toEnumValues(ProgressStatusValues));

export const contentStructureNodeProgress = pgTable(
	"content_structure_node_progress",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		nodeId: uuid().notNull(),
		completedAt: createTimestampMsColumn().defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.nodeId] }),
		foreignKey({
			columns: [table.nodeId],
			foreignColumns: [contentStructureNode.id],
			name: "content_structure_node_progress_node_fkey",
		}).onDelete("cascade"),
		index("content_structure_node_progress_node_idx").on(table.nodeId),
	],
);

export const unitProgress = pgTable(
	"unit_progress",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		progress: doublePrecision().default(0).notNull(),
		status: progressStatus().default("backlog").notNull(),
		completedCount: integer().default(0).notNull(),
		totalTimeMs: bigint({ mode: "bigint" }).default(0n).notNull(),
		firstSeenAt: createTimestampMsColumn().defaultNow().notNull(),
		lastSeenAt: createTimestampMsColumn().defaultNow().notNull(),
		lastContentStructureNodeId: uuid(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.unitId] }),
		foreignKey({
			columns: [table.lastContentStructureNodeId, table.unitId],
			foreignColumns: [contentStructureNode.id, contentStructureNode.ownerUnitId],
			name: "unit_progress_last_content_structure_node_fkey",
		}).onDelete("restrict"),
		index("unit_progress_unit_status_idx").on(table.unitId, table.status),
		index("unit_progress_profile_seen_idx")
			.on(table.profileId, table.lastSeenAt.desc(), table.unitId)
			.where(sql`${table.deletedAt} is null`),
		index("unit_progress_last_content_structure_node_idx").on(table.lastContentStructureNodeId),
		check("unit_progress_value_check", sql`${table.progress} between 0 and 1`),
		check(
			"unit_progress_count_check",
			sql`${table.completedCount} >= 0 and ${table.totalTimeMs} >= 0`,
		),
		check("unit_progress_seen_check", sql`${table.lastSeenAt} >= ${table.firstSeenAt}`),
		check(
			"unit_progress_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);
