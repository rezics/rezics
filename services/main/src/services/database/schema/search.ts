import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	customType,
	index,
	integer,
	pgEnum,
	text,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createTimestampMsColumn, createUuidv7PrimaryKey } from "./columns";

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
