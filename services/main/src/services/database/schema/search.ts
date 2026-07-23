import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	customType,
	foreignKey,
	index,
	integer,
	jsonb,
	pgEnum,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import type { SearchDocument, SharedSearchQueryDocument } from "@rezics/search";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile } from "./core";
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

export const SearchProjectionKindValues = ["current", "history"] as const;
export const SearchIndexGenerationStateValues = [
	"declared",
	"building",
	"catching_up",
	"verified",
	"active",
	"retired",
	"failed",
] as const;
export type SearchProjectionKind = (typeof SearchProjectionKindValues)[number];
export type SearchIndexGenerationState = (typeof SearchIndexGenerationStateValues)[number];

export const searchProjectionKind = pgEnum("search_projection_kind", SearchProjectionKindValues);
export const searchIndexGenerationState = pgEnum(
	"search_index_generation_state",
	SearchIndexGenerationStateValues,
);

const pgLsn = customType<{ data: string }>({ dataType: () => "pg_lsn" });

/** Durable current-state invalidation key and tombstone inventory for Sequin. */
export const searchUnitProjectionSource = pgTable(
	"search_unit_projection_source",
	{
		unitId: uuid().primaryKey(),
		revision: bigint({ mode: "bigint" }).default(1n).notNull(),
		touchedAt: createTimestampMsColumn().defaultNow().notNull(),
	},
	(table) => [
		index("search_unit_projection_source_touched_at_idx").on(table.touchedAt, table.unitId),
		check("search_unit_projection_source_revision_check", sql`${table.revision} > 0`),
	],
);

/** One row per point-in-time revision; never grouped or coalesced by Unit. */
export const searchRevisionProjectionSource = pgTable(
	"search_revision_projection_source",
	{
		revisionId: uuid().primaryKey(),
		revision: bigint({ mode: "bigint" }).default(1n).notNull(),
		touchedAt: createTimestampMsColumn().defaultNow().notNull(),
	},
	(table) => [
		index("search_revision_projection_source_touched_at_idx").on(
			table.touchedAt,
			table.revisionId,
		),
		check("search_revision_projection_source_revision_check", sql`${table.revision} > 0`),
	],
);

/** PostgreSQL-owned pointer to immutable, independently promoted index generations. */
export const searchIndexGeneration = pgTable(
	"search_index_generation",
	{
		id: createUuidv7PrimaryKey(),
		projectionKind: searchProjectionKind().notNull(),
		indexUid: text().notNull(),
		projectionVersion: integer().notNull(),
		settingsFingerprint: text().notNull(),
		sequinSinkName: text().notNull(),
		state: searchIndexGenerationState().default("declared").notNull(),
		sourceWatermarkLsn: pgLsn(),
		sourceWatermarkAt: createTimestampMsColumn(),
		lastVerifiedLsn: pgLsn(),
		verifiedAt: createTimestampMsColumn(),
		activatedAt: createTimestampMsColumn(),
		failure: text(),
	},
	(table) => [
		uniqueIndex("search_index_generation_index_uid_key").on(table.indexUid),
		uniqueIndex("search_index_generation_sequin_sink_name_key").on(table.sequinSinkName),
		uniqueIndex("search_index_generation_active_projection_key")
			.on(table.projectionKind)
			.where(sql`${table.state} = 'active'::search_index_generation_state`),
		index("search_index_generation_projection_state_idx").on(table.projectionKind, table.state),
		check(
			"search_index_generation_projection_version_check",
			sql`${table.projectionVersion} > 0`,
		),
		check(
			"search_index_generation_index_uid_check",
			sql`${table.indexUid} ~ '^rezics_(units|revisions)_v[1-9][0-9]*_[0-9]{8}(_[0-9]{6})?$'`,
		),
		check(
			"search_index_generation_settings_fingerprint_check",
			sql`${table.settingsFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"search_index_generation_state_metadata_check",
			sql`(${table.state} not in ('verified'::search_index_generation_state, 'active'::search_index_generation_state) or (${table.verifiedAt} is not null and ${table.lastVerifiedLsn} is not null)) and (${table.state} <> 'active'::search_index_generation_state or ${table.activatedAt} is not null) and (${table.state} <> 'failed'::search_index_generation_state or ${table.failure} is not null)`,
		),
	],
);
