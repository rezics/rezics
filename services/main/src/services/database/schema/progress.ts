import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	doublePrecision,
	foreignKey,
	index,
	integer,
	pgEnum,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	type ProgressCurrentBasis,
	ProgressCurrentBasisValues,
	type ProgressDatePrecision,
	ProgressDatePrecisionValues,
	DefaultResourceVisibility,
	type ProgressEntryKind,
	ProgressEntryKindValues,
	ProgressStatusValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
} from "./columns";
import { contentStructureNode } from "./content-structure";
import { contentStructureRevision } from "./content-structure-history";
import { profile, resourceVisibility, unit } from "./core";
import { post } from "./post";

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

/**
 * One user-editable checkpoint in a Profile's Unit progress journal.
 *
 * Entries are historical product records rather than an audit log. A checkpoint
 * may be edited or removed, and only entries with `affectsCurrent` participate
 * in selecting the current status snapshot.
 */
export const unitProgressEntry = pgTable(
	"unit_progress_entry",
	{
		id: createUuidv7PrimaryKey(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		entryKind: text().$type<ProgressEntryKind>().notNull(),
		status: progressStatus().notNull(),
		progress: doublePrecision().notNull(),
		completionDelta: integer().default(0).notNull(),
		totalTimeMs: bigint({ mode: "bigint" }).default(0n).notNull(),
		contentStructureNodeId: uuid(),
		contentStructureRevisionId: uuid(),
		occurredAt: createTimestampMsColumn(),
		datePrecision: text().$type<ProgressDatePrecision>().notNull(),
		affectsCurrent: boolean().default(true).notNull(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("unit_progress_entry_id_profile_unit_key").on(
			table.id,
			table.profileId,
			table.unitId,
		),
		foreignKey({
			columns: [table.contentStructureNodeId, table.unitId],
			foreignColumns: [contentStructureNode.id, contentStructureNode.ownerUnitId],
			name: "unit_progress_entry_content_structure_node_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.contentStructureRevisionId],
			foreignColumns: [contentStructureRevision.id],
			name: "unit_progress_entry_content_structure_revision_fkey",
		}).onDelete("restrict"),
		index("unit_progress_entry_profile_unit_occurred_idx")
			.on(
				table.profileId,
				table.unitId,
				table.occurredAt.desc(),
				table.createdAt.desc(),
				table.id.desc(),
			)
			.where(sql`${table.deletedAt} is null`),
		index("unit_progress_entry_unit_idx").on(table.unitId),
		index("unit_progress_entry_profile_unit_created_idx")
			.on(table.profileId, table.unitId, table.createdAt.desc())
			.where(sql`${table.deletedAt} is null`),
		index("unit_progress_entry_content_structure_node_idx").on(table.contentStructureNodeId),
		index("unit_progress_entry_content_structure_revision_idx").on(
			table.contentStructureRevisionId,
		),
		check("unit_progress_entry_kind_check", inArray(table.entryKind, ProgressEntryKindValues)),
		check(
			"unit_progress_entry_date_precision_check",
			inArray(table.datePrecision, ProgressDatePrecisionValues),
		),
		check("unit_progress_entry_value_check", sql`${table.progress} between 0 and 1`),
		check(
			"unit_progress_entry_completion_delta_check",
			sql`${table.completionDelta} between 0 and 1`,
		),
		check("unit_progress_entry_total_time_check", sql`${table.totalTimeMs} >= 0`),
		check(
			"unit_progress_entry_completion_shape_check",
			sql`${table.entryKind} <> 'completion' or (${table.status} = 'completed' and ${table.progress} = 1 and ${table.completionDelta} = 1 and ${table.contentStructureNodeId} is null)`,
		),
		check(
			"unit_progress_entry_occurred_at_check",
			sql`(${table.datePrecision} = 'unknown') = (${table.occurredAt} is null)`,
		),
		check(
			"unit_progress_entry_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
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
		currentEntryId: uuid(),
		currentBasis: text().$type<ProgressCurrentBasis>(),
		visibility: resourceVisibility().default(DefaultResourceVisibility).notNull(),
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
		foreignKey({
			columns: [table.currentEntryId],
			foreignColumns: [unitProgressEntry.id],
			name: "unit_progress_current_entry_fkey",
		}).onDelete("set null"),
		index("unit_progress_unit_status_idx").on(table.unitId, table.status),
		index("unit_progress_profile_seen_idx")
			.on(table.profileId, table.lastSeenAt.desc(), table.unitId)
			.where(sql`${table.deletedAt} is null`),
		index("unit_progress_public_profile_seen_idx")
			.on(table.profileId, table.lastSeenAt.desc(), table.unitId)
			.where(sql`${table.deletedAt} is null and ${table.visibility} = 'public'`),
		index("unit_progress_last_content_structure_node_idx").on(table.lastContentStructureNodeId),
		index("unit_progress_current_entry_idx").on(table.currentEntryId),
		check(
			"unit_progress_current_basis_check",
			sql`${table.currentBasis} is null or ${inArray(
				table.currentBasis,
				ProgressCurrentBasisValues,
			)}`,
		),
		check(
			"unit_progress_current_basis_shape_check",
			sql`case
				when ${table.currentBasis} is null then ${table.currentEntryId} is null
				when ${table.currentBasis} = 'journal' then ${table.currentEntryId} is not null
				when ${table.currentBasis} = 'reading' then ${table.currentEntryId} is null
				else false
			end`,
		),
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

/**
 * A Progress checkpoint linked by a Review Post.
 *
 * @remarks
 * This relation intentionally renders the current mutable journal entry.
 * Editing, deleting, or restricting its owning Progress may change or remove
 * the Progress shown by the Post. Introduce immutable snapshots only if
 * historical point-in-time rendering becomes a product guarantee.
 */
export const postProgressEntry = pgTable(
	"post_progress_entry",
	{
		postId: uuid()
			.primaryKey()
			.references(() => post.id, { onDelete: "cascade" }),
		progressEntryId: uuid().notNull(),
		position: fractionalIndexPosition().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.progressEntryId],
			foreignColumns: [unitProgressEntry.id],
			name: "post_progress_entry_progress_entry_fkey",
		}).onDelete("cascade"),
		unique("post_progress_entry_progress_entry_key").on(table.progressEntryId),
		unique("post_progress_entry_post_position_key").on(table.postId, table.position),
		index("post_progress_entry_progress_entry_idx").on(table.progressEntryId),
	],
);
