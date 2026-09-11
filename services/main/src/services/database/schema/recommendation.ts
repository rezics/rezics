import { referenceValue } from "./reference-value";
import { UnitOwnerValues, type UnitOwner } from "@rezics/reference";
import { unitReferenceColumns, unitReferenceConstraints } from "./unit-reference-columns";
import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	date,
	doublePrecision,
	foreignKey,
	index,
	pgEnum,
	smallint,
	primaryKey,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { users } from "./auth";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUuidv7PrimaryKey,
	displayPosition,
} from "./columns";
import {
	RecommendationEventTypeValues,
	RecommendationSnapshotStateValues,
	RecommendationSurfaceValues,
	toEnumValues,
} from "./contract-values";

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
		uniqueIndex("recommendation_snapshot_building_key").on(table.state).where(sql`${table.state}='building'`),
		unique("recommendation_snapshot_policy_watermark_key").on(table.policyVersion, table.sourceWatermark),
		index("recommendation_snapshot_retention_idx").on(table.startedAt, table.id).where(sql`not ${table.active} and ${table.state}<>'building'`),
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

/** Exactly 64 durable cursors per admitted snapshot; score writes and cursor progress commit together. */
export const recommendationSnapshotPartition = pgTable("recommendation_snapshot_partition", {
	snapshotId: uuid().notNull().references(() => recommendationSnapshot.id, { onDelete: "cascade" }),
	bucket: smallint().notNull(),
	state: text().$type<"pending" | "working" | "done" | "failed">().default("pending").notNull(),
	generation: bigint({ mode: "number" }).default(0).notNull(),
	leaseToken: uuid(), leaseExpiresAt: createTimestampMsColumn(),
	afterBucketStart: createTimestampMsColumn(), afterUnitId: uuid(), afterKind: text(),
	scannedRows: bigint({ mode: "bigint" }).default(0n).notNull(),
	failures: smallint().default(0).notNull(), nextAttemptAt: createTimestampMsColumn().defaultNow().notNull(),
	error: text(),
}, (table) => [
	primaryKey({ columns: [table.snapshotId, table.bucket] }),
	index("recommendation_snapshot_partition_claim_idx").on(table.snapshotId, table.state, table.nextAttemptAt, table.leaseExpiresAt, table.bucket),
	check("recommendation_snapshot_partition_values", sql`${table.bucket} between 0 and 63 and ${table.state} in ('pending','working','done','failed') and ${table.generation} between 0 and 9007199254740991 and ${table.scannedRows}>=0 and ${table.failures} between 0 and 12 and (${table.error} is null or octet_length(${table.error})<=2048)`),
	check("recommendation_snapshot_partition_lease", sql`(${table.state}='working') = (${table.leaseToken} is not null and ${table.leaseExpiresAt} is not null) and num_nonnulls(${table.leaseToken},${table.leaseExpiresAt}) in (0,2)`),
	check("recommendation_snapshot_partition_cursor", sql`num_nonnulls(${table.afterBucketStart},${table.afterUnitId},${table.afterKind}) in (0,3)`),
]);

export const recommendationEvent = pgTable(
	"recommendation_event",
	{
		id: createUuidv7PrimaryKey(),
		authUserId: uuid().references(() => users.id, { onDelete: "set null" }),
		requestId: uuid().notNull(),
		surface: recommendationSurface().notNull(),
		type: recommendationEventType().notNull(),
		targetReferenceId: uuid()
			.notNull()
			.references(() => referenceValue.id, { onDelete: "restrict" }),
		position: displayPosition().notNull(),
		policyVersion: text().notNull(),
		occurredAt: createTimestampMsColumn().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("recommendation_event_request_target_type_key").on(
			table.requestId,
			table.targetReferenceId,
			table.type,
		),
		index("recommendation_event_occurred_at_idx").on(table.occurredAt, table.id),
		index("recommendation_event_auth_occurred_at_idx").on(
			table.authUserId,
			table.occurredAt.desc(),
			table.id.desc(),
		),
		index("recommendation_event_target_occurred_at_idx").on(
			table.targetReferenceId,
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
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		targetReferenceId: uuid()
			.notNull()
			.references(() => referenceValue.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.authUserId, table.targetReferenceId] }),
		index("recommendation_exclusion_target_idx").on(table.targetReferenceId, table.authUserId),
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
		unitOwner: text().$type<UnitOwner>().notNull(),
		unitShape: text().notNull(),
		score: doublePrecision().notNull(),
		unitUpdatedAt: createTimestampMsColumn().notNull(),

		...unitReferenceColumns("unit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("unit_best_score", "unit", table, false, table.unitId),
		check("unit_best_score_owner_check", inArray(table.unitOwner, UnitOwnerValues)),

		primaryKey({ columns: [table.snapshotId, table.unitId] }),
		foreignKey({
			columns: [table.snapshotId],
			foreignColumns: [recommendationSnapshot.id],
			name: "unit_best_score_snapshot_fkey",
		}).onDelete("cascade"),

		index("unit_best_score_order_idx").on(
			table.snapshotId,
			table.score.desc().nullsFirst(),
			table.unitUpdatedAt.desc().nullsFirst(),
			table.unitId.desc().nullsFirst(),
		),
		index("unit_best_score_owner_order_idx").on(
			table.snapshotId,
			table.unitOwner,
			table.score.desc().nullsFirst(),
			table.unitUpdatedAt.desc().nullsFirst(),
			table.unitId.desc().nullsFirst(),
		),
		index("unit_best_score_owner_shape_order_idx").on(table.snapshotId, table.unitOwner, table.unitShape, table.score.desc(), table.unitUpdatedAt.desc(), table.unitId.desc()),
		index("unit_best_score_unit_merge_idx").on(table.unitId, table.snapshotId),
		check("unit_best_score_positive_check", sql`${table.score} > 0 and ${table.score} < 'Infinity'::double precision`),
	],
);

export const recommendationMetricDaily = pgTable(
	"recommendation_metric_daily",
	{
		day: date().notNull(),
		shard: smallint().notNull(),
		surface: recommendationSurface().notNull(),
		policyVersion: text().notNull(),
		impressions: bigint({ mode: "bigint" }).default(0n).notNull(),
		opens: bigint({ mode: "bigint" }).default(0n).notNull(),
		dwell30s: bigint("dwell_30s", { mode: "bigint" }).default(0n).notNull(),
		notInterested: bigint({ mode: "bigint" }).default(0n).notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.day, table.surface, table.policyVersion, table.shard] }),
		check("recommendation_metric_daily_shard_check",sql`${table.shard} between 0 and 127`),
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
