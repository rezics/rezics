import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, jsonb, text, unique, uuid } from "drizzle-orm/pg-core";
import type { SearchDocument, SharedSearchQueryDocument } from "@rezics/filter";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile } from "./profile";
import { revisionContent } from "./history";
import { zone } from "./zone";

/**
 * Immutable public Search query snapshots.
 *
 * The UUIDv7 primary key is the bearer identifier used by share links. Stored
 * presentation metadata is never trusted for execution; the API revalidates
 * the Search Feature state before insert and after read.
 */
export const sharedSearchQuery = pgTable(
	"shared_search_query",
	{
		id: createUuidv7PrimaryKey(),
		document: jsonb().$type<SharedSearchQueryDocument>().notNull(),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		check(
			"shared_search_query_document_check",
			sql`jsonb_typeof(${table.document}) = 'object'`,
		),
	],
);

/** A reusable, versioned Search Feature contract. v1 authoring is exposed only through Zones. */
export const searchDocument = pgTable(
	"search_document",
	{
		id: createUuidv7PrimaryKey(),
		document: jsonb().$type<SearchDocument>().notNull(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check("search_document_document_check", sql`jsonb_typeof(${table.document}) = 'object'`),
		check(
			"search_document_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);

/** Zone-owned activation and binding for an independently versioned SearchDocument. */
export const zoneSearchFeature = pgTable(
	"zone_search_feature",
	{
		zoneId: uuid()
			.primaryKey()
			.references(() => zone.id, { onDelete: "cascade" }),
		searchDocumentId: uuid()
			.notNull()
			.references(() => searchDocument.id, { onDelete: "restrict" }),
		enabled: boolean().default(false).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [unique("zone_search_feature_document_key").on(table.searchDocumentId)],
);

export const searchDocumentRevision = pgTable(
	"search_document_revision",
	{
		id: createUuidv7PrimaryKey(),
		searchDocumentId: uuid()
			.notNull()
			.references(() => searchDocument.id, { onDelete: "restrict" }),
		parentRevisionId: uuid(),
		sourceRevisionId: uuid(),
		contentId: uuid()
			.notNull()
			.references(() => revisionContent.id, { onDelete: "restrict" }),
		actorProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		/** @UNIT_LOCALIZATION_EXEMPT Authored point-in-time edit summary, never interface copy. */
		editSummary: text(),
		kind: text().$type<"create" | "update" | "delete" | "restore">().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("search_document_revision_id_document_key").on(table.id, table.searchDocumentId),
		foreignKey({
			columns: [table.parentRevisionId, table.searchDocumentId],
			foreignColumns: [table.id, table.searchDocumentId],
			name: "search_document_revision_parent_document_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.sourceRevisionId, table.searchDocumentId],
			foreignColumns: [table.id, table.searchDocumentId],
			name: "search_document_revision_source_document_fkey",
		}).onDelete("restrict"),
		index("search_document_revision_document_created_at_idx").on(
			table.searchDocumentId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("search_document_revision_content_idx").on(table.contentId),
		check(
			"search_document_revision_kind_check",
			sql`${table.kind} in ('create', 'update', 'delete', 'restore')`,
		),
		check(
			"search_document_revision_source_shape_check",
			sql`(${table.kind} = 'restore') = (${table.sourceRevisionId} is not null)`,
		),
	],
);

export const searchDocumentRevisionHead = pgTable(
	"search_document_revision_head",
	{
		searchDocumentId: uuid()
			.primaryKey()
			.references(() => searchDocument.id, { onDelete: "cascade" }),
		revisionId: uuid().notNull(),
	},
	(table) => [
		unique("search_document_revision_head_revision_key").on(table.revisionId),
		foreignKey({
			columns: [table.revisionId, table.searchDocumentId],
			foreignColumns: [searchDocumentRevision.id, searchDocumentRevision.searchDocumentId],
			name: "search_document_revision_head_revision_document_fkey",
		}).onDelete("restrict"),
	],
);
