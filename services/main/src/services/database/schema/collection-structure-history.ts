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
import { collection } from "./collection";
import { profile } from "./profile";
import { revisionContent } from "./history";

/** One immutable commit in a Collection Items structure's revision stream. */
export const collectionStructureRevision = pgTable(
	"collection_structure_revision",
	{
		id: createUuidv7PrimaryKey(),
		collectionId: uuid().notNull(),
		parentRevisionId: uuid(),
		sourceRevisionId: uuid(),
		contentId: uuid()
			.notNull()
			.references(() => revisionContent.id, { onDelete: "restrict" }),
		actorProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		/** @UNIT_LOCALIZATION_EXEMPT Authored point-in-time edit summary, never interface copy. */
		editSummary: text(),
		kind: text().$type<"create" | "update" | "restore">().notNull(),
		minor: boolean().default(false).notNull(),
		replayByteSize: integer().notNull(),
		checkpointByteSize: integer().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("collection_structure_revision_id_collection_key").on(table.id, table.collectionId),
		foreignKey({
			columns: [table.collectionId],
			foreignColumns: [collection.id],
			name: "collection_structure_revision_collection_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.parentRevisionId, table.collectionId],
			foreignColumns: [table.id, table.collectionId],
			name: "collection_structure_revision_parent_collection_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.sourceRevisionId, table.collectionId],
			foreignColumns: [table.id, table.collectionId],
			name: "collection_structure_revision_source_collection_fkey",
		}).onDelete("restrict"),
		index("collection_structure_revision_collection_created_at_idx").on(
			table.collectionId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("collection_structure_revision_parent_idx").on(table.parentRevisionId),
		index("collection_structure_revision_source_idx").on(table.sourceRevisionId),
		index("collection_structure_revision_content_idx").on(table.contentId),
		index("collection_structure_revision_actor_created_at_idx").on(
			table.actorProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check(
			"collection_structure_revision_replay_byte_size_check",
			sql`${table.replayByteSize} >= 0`,
		),
		check(
			"collection_structure_revision_checkpoint_byte_size_check",
			sql`${table.checkpointByteSize} >= 0`,
		),
		check(
			"collection_structure_revision_kind_check",
			sql`${table.kind} in ('create', 'update', 'restore')`,
		),
		check(
			"collection_structure_revision_source_shape_check",
			sql`(${table.kind} = 'restore') = (${table.sourceRevisionId} is not null)`,
		),
	],
);

/** Current optimistic-concurrency token for one Collection Items structure. */
export const collectionStructureRevisionHead = pgTable(
	"collection_structure_revision_head",
	{
		collectionId: uuid().primaryKey(),
		revisionId: uuid().notNull(),
	},
	(table) => [
		unique("collection_structure_revision_head_revision_key").on(table.revisionId),
		foreignKey({
			columns: [table.collectionId],
			foreignColumns: [collection.id],
			name: "collection_structure_revision_head_collection_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.revisionId, table.collectionId],
			foreignColumns: [collectionStructureRevision.id, collectionStructureRevision.collectionId],
			name: "collection_structure_revision_head_revision_collection_fkey",
		}).onDelete("restrict"),
	],
);
