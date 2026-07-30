import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	date,
	doublePrecision,
	foreignKey,
	index,
	integer,
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
import { realm } from "./realm";

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
		uniqueIndex("recommendation_snapshot_active_key")
			.on(table.active)
			.where(sql`${table.active}`),
		index("recommendation_snapshot_state_started_at_idx").on(
			table.state,
			table.startedAt.desc(),
		),
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

export const recommendationUnitStat = pgTable(
	"recommendation_unit_stat",
	{
		id: createUuidv7PrimaryKey(),
		snapshotId: uuid().notNull(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		contextRealmId: uuid().references(() => realm.id, { onDelete: "cascade" }),
		impressions: bigint({ mode: "bigint" }).default(0n).notNull(),
		opens: bigint({ mode: "bigint" }).default(0n).notNull(),
		dwell30s: bigint("dwell_30s", { mode: "bigint" }).default(0n).notNull(),
		upvotes: bigint({ mode: "bigint" }).default(0n).notNull(),
		downvotes: bigint({ mode: "bigint" }).default(0n).notNull(),
		replies: bigint({ mode: "bigint" }).default(0n).notNull(),
		favorites: bigint({ mode: "bigint" }).default(0n).notNull(),
		shares: bigint({ mode: "bigint" }).default(0n).notNull(),
		highScores: bigint({ mode: "bigint" }).default(0n).notNull(),
		activeProgress: bigint({ mode: "bigint" }).default(0n).notNull(),
		completions: bigint({ mode: "bigint" }).default(0n).notNull(),
		negativeProgress: bigint({ mode: "bigint" }).default(0n).notNull(),
		engagement6h: doublePrecision("engagement_6h").default(0).notNull(),
		engagement24h: doublePrecision("engagement_24h").default(0).notNull(),
		engagement7d: doublePrecision("engagement_7d").default(0).notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("recommendation_unit_stat_identity_key")
			.on(table.snapshotId, table.unitId, table.contextRealmId)
			.nullsNotDistinct(),
		foreignKey({
			columns: [table.snapshotId],
			foreignColumns: [recommendationSnapshot.id],
			name: "recommendation_stat_snapshot_fkey",
		}).onDelete("cascade"),
		index("recommendation_unit_stat_snapshot_unit_idx").on(table.snapshotId, table.unitId),
		index("recommendation_unit_stat_snapshot_hot_idx").on(
			table.snapshotId,
			table.engagement24h.desc(),
			table.unitId,
		),
		check(
			"recommendation_unit_stat_counts_check",
			sql`${table.impressions} >= 0 and ${table.opens} >= 0 and ${table.dwell30s} >= 0 and ${table.upvotes} >= 0 and ${table.downvotes} >= 0 and ${table.replies} >= 0 and ${table.favorites} >= 0 and ${table.shares} >= 0 and ${table.highScores} >= 0 and ${table.activeProgress} >= 0 and ${table.completions} >= 0 and ${table.negativeProgress} >= 0`,
		),
		check(
			"recommendation_unit_stat_engagement_check",
			sql`${table.engagement6h} >= 0 and ${table.engagement24h} >= 0 and ${table.engagement7d} >= 0`,
		),
	],
);

export const recommendationUnitEdge = pgTable(
	"recommendation_unit_edge",
	{
		snapshotId: uuid().notNull(),
		sourceUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		targetUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		structuralScore: doublePrecision().default(0).notNull(),
		behavioralScore: doublePrecision().default(0).notNull(),
		score: doublePrecision().notNull(),
		rank: integer().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.snapshotId, table.sourceUnitId, table.targetUnitId] }),
		foreignKey({
			columns: [table.snapshotId],
			foreignColumns: [recommendationSnapshot.id],
			name: "recommendation_edge_snapshot_fkey",
		}).onDelete("cascade"),
		index("recommendation_unit_edge_source_rank_idx").on(
			table.snapshotId,
			table.sourceUnitId,
			table.rank,
		),
		index("recommendation_unit_edge_target_idx").on(table.snapshotId, table.targetUnitId),
		check(
			"recommendation_unit_edge_not_self_check",
			sql`${table.sourceUnitId} <> ${table.targetUnitId}`,
		),
		check(
			"recommendation_unit_edge_score_check",
			sql`${table.structuralScore} >= 0 and ${table.behavioralScore} >= 0 and ${table.score} > 0 and ${table.rank} between 1 and 100`,
		),
	],
);

export const recommendationProfileInterest = pgTable(
	"recommendation_profile_interest",
	{
		snapshotId: uuid().notNull(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		weight: doublePrecision().notNull(),
		rank: integer().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.snapshotId, table.profileId, table.unitId] }),
		foreignKey({
			columns: [table.snapshotId],
			foreignColumns: [recommendationSnapshot.id],
			name: "recommendation_interest_snapshot_fkey",
		}).onDelete("cascade"),
		index("recommendation_profile_interest_profile_rank_idx").on(
			table.snapshotId,
			table.profileId,
			table.rank,
		),
		check(
			"recommendation_profile_interest_value_check",
			sql`${table.weight} > 0 and ${table.rank} between 1 and 50`,
		),
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
