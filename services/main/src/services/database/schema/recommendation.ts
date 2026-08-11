import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	date,
	doublePrecision,
	foreignKey,
	index,
	pgEnum,
	primaryKey,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	RecommendationEventTypeValues,
	RecommendationSnapshotStateValues,
	RecommendationSurfaceValues,
	type UnitKind,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUuidv7PrimaryKey,
	displayPosition,
} from "./columns";
import { profile } from "./profile";
import { unit } from "./unit";

export const recommendationSurface = pgEnum(
	"recommendation_surface",
	toEnumValues(RecommendationSurfaceValues),
);
export const recommendationEventType = pgEnum(
	"recommendation_event_type",
	toEnumValues(RecommendationEventTypeValues),
);
export const recommendationSnapshotState = pgEnum(
	"recommendation_snapshot_state",
	toEnumValues(RecommendationSnapshotStateValues),
);

export const recommendationSnapshot = pgTable(
	"recommendation_snapshot",
	{
		id: createUuidv7PrimaryKey(),
		policyVersion: text().notNull(),
		state: recommendationSnapshotState().default("building").notNull(),
		active: boolean().default(false).notNull(),
		sourceWatermark: createTimestampMsColumn(),
		startedAt: createCreatedAtColumn(),
		completedAt: createTimestampMsColumn(),
		/** @UNIT_LOCALIZATION_EXEMPT Machine diagnostic: raw snapshot failure detail for operators, never display copy. */
		error: text(),
	},
	(table) => [
		uniqueIndex("recommendation_snapshot_active_key").on(table.active).where(sql`${table.active}`),
		index("recommendation_snapshot_state_started_at_idx").on(table.state, table.startedAt.desc()),
		check(
			"recommendation_snapshot_policy_version_not_blank",
			sql`btrim(${table.policyVersion}) <> ''`,
		),
		check(
			"recommendation_snapshot_active_ready_check",
			sql`not ${table.active} or (${table.state} = 'ready'::recommendation_snapshot_state and ${table.completedAt} is not null)`,
		),
		check(
			"recommendation_snapshot_completion_check",
			sql`(${table.state} = 'building'::recommendation_snapshot_state and ${table.completedAt} is null) or (${table.state} <> 'building'::recommendation_snapshot_state and ${table.completedAt} is not null)`,
		),
	],
);

export const recommendationEvent = pgTable(
	"recommendation_event",
	{
		id: createUuidv7PrimaryKey(),
		profileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		requestId: uuid().notNull(),
		surface: recommendationSurface().notNull(),
		type: recommendationEventType().notNull(),
		targetUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		position: displayPosition().notNull(),
		policyVersion: text().notNull(),
		occurredAt: createTimestampMsColumn().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("recommendation_event_request_target_type_key").on(
			table.requestId,
			table.targetUnitId,
			table.type,
		),
		index("recommendation_event_occurred_at_idx").on(table.occurredAt, table.id),
		index("recommendation_event_profile_occurred_at_idx").on(
			table.profileId,
			table.occurredAt.desc(),
			table.id.desc(),
		),
		index("recommendation_event_target_occurred_at_idx").on(
			table.targetUnitId,
			table.occurredAt.desc(),
		),
		check("recommendation_event_position_check", sql`${table.position} between 0 and 999`),
		check(
			"recommendation_event_policy_version_not_blank",
			sql`btrim(${table.policyVersion}) <> ''`,
		),
	],
);

export const recommendationExclusion = pgTable(
	"recommendation_exclusion",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.unitId] }),
		index("recommendation_exclusion_unit_idx").on(table.unitId, table.profileId),
	],
);

/**
 * Sparse, immutable `best` ordering projection for one recommendation snapshot.
 *
 * Zero-score Units are deliberately absent and are read from the public Unit
 * updated-at index. Work and storage therefore follow recently active Units,
 * never the complete discovery universe.
 */
export const unitBestScore = pgTable(
	"unit_best_score",
	{
		snapshotId: uuid().notNull(),
		unitId: uuid().notNull(),
		unitKind: text().$type<UnitKind>().notNull(),
		score: doublePrecision().notNull(),
		unitUpdatedAt: createTimestampMsColumn().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.snapshotId, table.unitId] }),
		foreignKey({
			columns: [table.snapshotId],
			foreignColumns: [recommendationSnapshot.id],
			name: "unit_best_score_snapshot_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.unitId, table.unitKind],
			foreignColumns: [unit.id, unit.kind],
			name: "unit_best_score_unit_fkey",
		}).onDelete("cascade"),
		index("unit_best_score_order_idx").on(
			table.snapshotId,
			table.score.desc().nullsFirst(),
			table.unitUpdatedAt.desc().nullsFirst(),
			table.unitId.desc().nullsFirst(),
		),
		index("unit_best_score_kind_order_idx").on(
			table.snapshotId,
			table.unitKind,
			table.score.desc().nullsFirst(),
			table.unitUpdatedAt.desc().nullsFirst(),
			table.unitId.desc().nullsFirst(),
		),
		index("unit_best_score_unit_merge_idx").on(table.unitId, table.snapshotId),
		check("unit_best_score_positive_check", sql`${table.score} > 0`),
	],
);

export const recommendationMetricDaily = pgTable(
	"recommendation_metric_daily",
	{
		day: date().notNull(),
		surface: recommendationSurface().notNull(),
		policyVersion: text().notNull(),
		impressions: bigint({ mode: "bigint" }).default(0n).notNull(),
		opens: bigint({ mode: "bigint" }).default(0n).notNull(),
		dwell30s: bigint("dwell_30s", { mode: "bigint" }).default(0n).notNull(),
		notInterested: bigint({ mode: "bigint" }).default(0n).notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.day, table.surface, table.policyVersion] }),
		check(
			"recommendation_metric_daily_policy_version_not_blank",
			sql`btrim(${table.policyVersion}) <> ''`,
		),
		check(
			"recommendation_metric_daily_counts_check",
			sql`${table.impressions} >= 0 and ${table.opens} >= 0 and ${table.dwell30s} >= 0 and ${table.notInterested} >= 0`,
		),
	],
);
