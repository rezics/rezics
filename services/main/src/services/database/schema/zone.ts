import { sql } from "drizzle-orm";
import type { SearchDocument } from "@rezics/filter";
import { boolean, check, foreignKey, index, jsonb, text, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { revisionContent } from "./history";
import { profile } from "./profile";
import { unit } from "./unit";

export const zone = pgTable(
	"zone",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		/** @UNIT_LOCALIZATION_EXEMPT Structured contract: search boundary contains only categories and filters. */
		boundaryDocument: createJsonDocumentColumn().notNull(),
		/** @UNIT_LOCALIZATION_EXEMPT Structured contract: theme contains only color and density tokens. */
		themeDocument: createJsonDocumentColumn().notNull(),
		startsAt: createTimestampMsColumn(),
		endsAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check(
			"zone_time_range_check",
			sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.endsAt} > ${table.startsAt}`,
		),
	],
);

/**
 * Proves that a Zone Page Unit belongs to a Zone.
 *
 * The same Unit also has `post.kind = page` with this Zone as its subject.
 * Slug addresses are optional and page-structure is only a visual index, so
 * neither can serve as the ownership relation.
 */
export const zonePage = pgTable(
	"zone_page",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		zoneId: uuid()
			.notNull()
			.references(() => zone.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [index("zone_page_zone_created_idx").on(table.zoneId, table.createdAt, table.id)],
);

/**
 * Stores the versioned configuration for a Zone-owned Search Feature.
 *
 * @remarks
 * Despite its persisted v1 name, this is presentation and execution configuration for a Zone.
 * It is not a full-text search projection and none of its JSON is indexed by PGroonga.
 */
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

/** Activates and binds one versioned SearchDocument exclusively to its owning Zone. */
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

/** Records immutable edits to a Zone-owned SearchDocument. */
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

/** Points to the current immutable revision of a Zone-owned SearchDocument. */
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
