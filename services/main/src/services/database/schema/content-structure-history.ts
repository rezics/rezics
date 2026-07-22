import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	integer,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { contentStructure } from "./content-structure";
import { profile } from "./core";
import { revisionContent } from "./history";

/** One immutable commit in a Content Structure aggregate's independent revision stream. */
export const contentStructureRevision = pgTable(
	"content_structure_revision",
	{
		id: createUuidv7PrimaryKey(),
		structureId: uuid().notNull(),
		parentRevisionId: uuid(),
		sourceRevisionId: uuid(),
		contentId: uuid()
			.notNull()
			.references(() => revisionContent.id, { onDelete: "restrict" }),
		actorProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		/** @UNIT_LOCALIZATION_EXEMPT Authored point-in-time edit summary, never interface copy. */
		editSummary: text(),
		kind: text().$type<"create" | "update" | "delete" | "restore">().notNull(),
		minor: boolean().default(false).notNull(),
		/** Bytes replayed after the nearest full checkpoint to materialize this revision. */
		replayByteSize: integer().notNull(),
		/** Serialized byte size of the full checkpoint anchoring this revision. */
		checkpointByteSize: integer().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("content_structure_revision_id_structure_key").on(table.id, table.structureId),
		foreignKey({
			columns: [table.structureId],
			foreignColumns: [contentStructure.id],
			name: "content_structure_revision_structure_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.parentRevisionId, table.structureId],
			foreignColumns: [table.id, table.structureId],
			name: "content_structure_revision_parent_structure_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.sourceRevisionId, table.structureId],
			foreignColumns: [table.id, table.structureId],
			name: "content_structure_revision_source_structure_fkey",
		}).onDelete("restrict"),
		index("content_structure_revision_structure_created_at_idx").on(
			table.structureId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("content_structure_revision_parent_idx").on(table.parentRevisionId),
		index("content_structure_revision_source_idx").on(table.sourceRevisionId),
		index("content_structure_revision_content_idx").on(table.contentId),
		index("content_structure_revision_actor_created_at_idx").on(
			table.actorProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check(
			"content_structure_revision_replay_byte_size_check",
			sql`${table.replayByteSize} >= 0`,
		),
		check(
			"content_structure_revision_checkpoint_byte_size_check",
			sql`${table.checkpointByteSize} >= 0`,
		),
		check(
			"content_structure_revision_kind_check",
			sql`${table.kind} in ('create', 'update', 'delete', 'restore')`,
		),
		check(
			"content_structure_revision_source_shape_check",
			sql`(${table.kind} = 'restore') = (${table.sourceRevisionId} is not null)`,
		),
	],
);

/** Current optimistic-concurrency token for exactly one Content Structure aggregate. */
export const contentStructureRevisionHead = pgTable(
	"content_structure_revision_head",
	{
		structureId: uuid().primaryKey(),
		revisionId: uuid().notNull(),
	},
	(table) => [
		unique("content_structure_revision_head_revision_key").on(table.revisionId),
		foreignKey({
			columns: [table.structureId],
			foreignColumns: [contentStructure.id],
			name: "content_structure_revision_head_structure_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.revisionId, table.structureId],
			foreignColumns: [contentStructureRevision.id, contentStructureRevision.structureId],
			name: "content_structure_revision_head_revision_structure_fkey",
		}).onDelete("restrict"),
	],
);
