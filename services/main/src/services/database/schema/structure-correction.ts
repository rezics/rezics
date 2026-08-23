import { inArray, sql } from "drizzle-orm";
import { snakeCase } from "drizzle-orm/pg-core";
import {
	bigint,
	boolean,
	check,
	doublePrecision,
	foreignKey,
	index,
	integer,
	primaryKey,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import {
	type RevisionContributionRole,
	RevisionContributionRoleValues,
	type UnitRevisionPrimaryContributionKind,
	UnitRevisionPrimaryContributionKindValues,
} from "./contract-values";
import { entity } from "./entity";
import { profile } from "./profile";
import { unitRevision } from "./history";
import { unitStructure } from "./structure";
import { tag } from "./tag";
import { unit } from "./unit";

export const UnitStructureCorrectionMaximumPendingJobs = 1_024 as const;
export const UnitStructureCorrectionMaximumStagingJobs = 8 as const;
export const UnitStructureCorrectionShardCount = 256 as const;
export const UnitStructureCorrectionDefaultBatchSize = 1_000 as const;
export const UnitStructureCorrectionMaximumBatchSize = 10_000 as const;
export const UnitStructureCorrectionDefaultLeaseSeconds = 30 as const;
export const UnitStructureCorrectionMaximumAttempts = 8 as const;

export const UnitStructureCorrectionStatusValues = [
	"pending",
	"preflighting",
	"staging",
	"reconciling",
	"ready",
	"activating",
	"active_overlay",
	"compacting",
	"route_switching",
	"cleaning",
	"completed",
	"failing",
	"failed",
	"cancelled",
] as const;
export type UnitStructureCorrectionStatus = (typeof UnitStructureCorrectionStatusValues)[number];

export const UnitStructureCorrectionWriteRouteValues = ["source", "overlay", "target"] as const;
export type UnitStructureCorrectionWriteRoute =
	(typeof UnitStructureCorrectionWriteRouteValues)[number];

export const UnitStructureCorrectionShardPhaseValues = [
	"preflight_application",
	"preflight_judgment",
	"stage_support",
	"stage_effective_vote",
	"verify_target",
	"compact_tag_upsert",
	"compact_vote",
	"compact_stat",
	"compact_tag_delete",
	"cleanup_support",
	"cleanup_projection",
] as const;
export type UnitStructureCorrectionShardPhase =
	(typeof UnitStructureCorrectionShardPhaseValues)[number];

/** Singleton operational bounds; deployments may tune downward, never above the proved maxima. */
export const unitStructureCorrectionPolicy = pgTable(
	"unit_structure_correction_policy",
	{
		id: boolean().primaryKey().default(true),
		admissionOpen: boolean().default(true).notNull(),
		maximumPendingJobs: integer().default(UnitStructureCorrectionMaximumPendingJobs).notNull(),
		maximumStagingJobs: integer().default(UnitStructureCorrectionMaximumStagingJobs).notNull(),
		shardCount: integer().default(UnitStructureCorrectionShardCount).notNull(),
		batchSize: integer().default(UnitStructureCorrectionDefaultBatchSize).notNull(),
		leaseSeconds: integer().default(UnitStructureCorrectionDefaultLeaseSeconds).notNull(),
		minimumHeadroomBasisPoints: integer().default(20_000).notNull(),
		maximumStagingBytes: bigint({ mode: "bigint" }).default(0n).notNull(),
		estimatedBytesPerTargetSupport: integer().default(512).notNull(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check("unit_structure_correction_policy_singleton_check", sql`${table.id}`),
		check(
			"unit_structure_correction_policy_pending_check",
			sql`${table.maximumPendingJobs} between 1 and ${UnitStructureCorrectionMaximumPendingJobs}`,
		),
		check(
			"unit_structure_correction_policy_staging_check",
			sql`${table.maximumStagingJobs} between 1 and ${UnitStructureCorrectionMaximumStagingJobs}`,
		),
		check(
			"unit_structure_correction_policy_shard_check",
			sql`${table.shardCount} = ${UnitStructureCorrectionShardCount}`,
		),
		check(
			"unit_structure_correction_policy_batch_check",
			sql`${table.batchSize} between 1 and ${UnitStructureCorrectionMaximumBatchSize}`,
		),
		check(
			"unit_structure_correction_policy_lease_check",
			sql`${table.leaseSeconds} between 5 and 300`,
		),
		check(
			"unit_structure_correction_policy_headroom_check",
			sql`${table.minimumHeadroomBasisPoints} >= 20000`,
		),
		check(
			"unit_structure_correction_policy_storage_check",
			sql`${table.maximumStagingBytes} >= 0
				and ${table.estimatedBytesPerTargetSupport} between 128 and 4096`,
		),
	],
);

/** Durable correction intent; database reservations freeze its bounded source facts. */
export const unitStructureCorrection = pgTable(
	"unit_structure_correction",
	{
		id: createUuidv7PrimaryKey(),
		structureId: uuid()
			.notNull()
			.references(() => unitStructure.id, { onDelete: "restrict" }),
		sourceProjectionVersion: integer().notNull(),
		targetProjectionVersion: integer().notNull(),
		sourceMemberUnitIds: uuid().array().notNull(),
		targetMemberUnitIds: uuid().array().notNull(),
		expectedStructureUpdatedAt: createTimestampMsColumn().notNull(),
		requestedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		reason: text().notNull(),
		contributionKind: text().$type<UnitRevisionPrimaryContributionKind>().notNull(),
		creditedEntityId: uuid().references(() => entity.id, { onDelete: "restrict" }),
		contributionRole: text().$type<RevisionContributionRole>(),
		status: text().$type<UnitStructureCorrectionStatus>().default("pending").notNull(),
		writeRoute: text().$type<UnitStructureCorrectionWriteRoute>().default("source").notNull(),
		expectedApplicationCount: bigint({ mode: "bigint" }),
		expectedPositiveJudgmentCount: bigint({ mode: "bigint" }),
		expectedTargetSupportCount: bigint({ mode: "bigint" }),
		requiredStagingBytes: bigint({ mode: "bigint" }),
		preflightCompletedAt: createTimestampMsColumn(),
		headroomAdmittedAt: createTimestampMsColumn(),
		availableAt: createTimestampMsColumn().defaultNow().notNull(),
		leaseOwner: text(),
		leaseToken: uuid(),
		leaseExpiresAt: createTimestampMsColumn(),
		attemptCount: integer().default(0).notNull(),
		failedFromStatus: text().$type<UnitStructureCorrectionStatus>(),
		activatedAt: createTimestampMsColumn(),
		activationRevisionId: uuid(),
		activationAuditRecordedAt: createTimestampMsColumn(),
		completedAt: createTimestampMsColumn(),
		failedAt: createTimestampMsColumn(),
		cancelledAt: createTimestampMsColumn(),
		lastErrorCode: text(),
		lastErrorMessage: text(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("unit_structure_correction_structure_target_version_completed_idx")
			.on(table.structureId, table.targetProjectionVersion)
			.where(sql`${table.status} = 'completed'`),
		uniqueIndex("unit_structure_correction_structure_open_idx")
			.on(table.structureId)
			.where(sql`${table.status} not in ('completed', 'failed', 'cancelled')`),
		foreignKey({
			columns: [table.activationRevisionId],
			foreignColumns: [unitRevision.id],
			name: "unit_structure_correction_activation_revision_fkey",
		}).onDelete("restrict"),
		index("unit_structure_correction_queue_idx").on(
			table.status,
			table.availableAt,
			table.leaseExpiresAt,
			table.createdAt,
			table.id,
		),
		index("unit_structure_correction_route_idx").on(table.writeRoute, table.status, table.id),
		check(
			"unit_structure_correction_status_check",
			inArray(table.status, UnitStructureCorrectionStatusValues),
		),
		check(
			"unit_structure_correction_write_route_check",
			inArray(table.writeRoute, UnitStructureCorrectionWriteRouteValues),
		),
		check(
			"unit_structure_correction_version_check",
			sql`${table.sourceProjectionVersion} > 0
				and ${table.targetProjectionVersion} = ${table.sourceProjectionVersion} + 1`,
		),
		check(
			"unit_structure_correction_source_member_count_check",
			sql`cardinality(${table.sourceMemberUnitIds}) between 2 and 16`,
		),
		check(
			"unit_structure_correction_target_member_count_check",
			sql`cardinality(${table.targetMemberUnitIds}) between 2 and 16`,
		),
		check(
			"unit_structure_correction_reason_check",
			sql`length(btrim(${table.reason})) between 1 and 500`,
		),
		check(
			"unit_structure_correction_contribution_kind_check",
			inArray(table.contributionKind, UnitRevisionPrimaryContributionKindValues),
		),
		check(
			"unit_structure_correction_contribution_role_check",
			sql`${table.contributionRole} is null
				or ${table.contributionRole} in (${sql.join(
					RevisionContributionRoleValues.map((value) => sql`${value}`),
					sql`, `,
				)})`,
		),
		check(
			"unit_structure_correction_contribution_shape_check",
			sql`(${table.contributionKind} = 'ai'
					and ${table.creditedEntityId} is not null
					and ${table.contributionRole} is not null)
				or (${table.contributionKind} <> 'ai'
					and ${table.creditedEntityId} is null
					and ${table.contributionRole} is null)`,
		),
		check(
			"unit_structure_correction_lease_shape_check",
			sql`(${table.leaseOwner} is null
				and ${table.leaseToken} is null
				and ${table.leaseExpiresAt} is null)
				or (${table.leaseOwner} is not null
					and ${table.leaseToken} is not null
					and ${table.leaseExpiresAt} is not null)`,
		),
		check(
			"unit_structure_correction_preflight_count_check",
			sql`(${table.expectedApplicationCount} is null or ${table.expectedApplicationCount} >= 0)
				and (${table.expectedPositiveJudgmentCount} is null
					or ${table.expectedPositiveJudgmentCount} >= 0)
				and (${table.expectedTargetSupportCount} is null
					or ${table.expectedTargetSupportCount} >= 0)
				and (${table.requiredStagingBytes} is null or ${table.requiredStagingBytes} >= 0)
				and ${table.attemptCount} between 0 and ${UnitStructureCorrectionMaximumAttempts}`,
		),
		check(
			"unit_structure_correction_preflight_shape_check",
			sql`(${table.preflightCompletedAt} is null
				and ${table.headroomAdmittedAt} is null
				and ${table.expectedTargetSupportCount} is null
				and ${table.requiredStagingBytes} is null)
				or (${table.preflightCompletedAt} is not null
					and ${table.headroomAdmittedAt} is not null
					and ${table.expectedApplicationCount} is not null
					and ${table.expectedPositiveJudgmentCount} is not null
					and ${table.expectedTargetSupportCount} is not null
					and ${table.requiredStagingBytes} is not null)`,
		),
		check(
			"unit_structure_correction_activation_evidence_shape_check",
			sql`(${table.activationRevisionId} is null) =
				(${table.activationAuditRecordedAt} is null)`,
		),
		check(
			"unit_structure_correction_failure_shape_check",
			sql`(${table.status} in ('failing', 'failed')) =
					(${table.failedFromStatus} is not null)
				and (${table.status} = 'failed') = (${table.failedAt} is not null)
				and (${table.status} = 'completed') = (${table.completedAt} is not null)
				and (${table.status} = 'cancelled') = (${table.cancelledAt} is not null)
				and (${table.status} in ('failing', 'failed')) =
					(${table.lastErrorCode} is not null and ${table.lastErrorMessage} is not null)
				and (${table.failedFromStatus} is null or ${table.failedFromStatus}
					not in ('failing', 'failed', 'completed', 'cancelled'))
				and (${table.status} not in ('completed', 'failed', 'cancelled')
					or (${table.leaseOwner} is null
						and ${table.leaseToken} is null
						and ${table.leaseExpiresAt} is null))`,
		),
	],
);

/** Hash-shard cursor and renewable lease for horizontally parallel phases. */
export const unitStructureCorrectionShard = pgTable(
	"unit_structure_correction_shard",
	{
		jobId: uuid()
			.notNull()
			.references(() => unitStructureCorrection.id, { onDelete: "cascade" }),
		phase: text().$type<UnitStructureCorrectionShardPhase>().notNull(),
		shard: integer().notNull(),
		cursorUnitId: uuid(),
		cursorTagId: uuid(),
		cursorProfileId: uuid(),
		leaseOwner: text(),
		leaseToken: uuid(),
		leaseExpiresAt: createTimestampMsColumn(),
		processedCount: bigint({ mode: "bigint" }).default(0n).notNull(),
		completedAt: createTimestampMsColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.jobId, table.phase, table.shard] }),
		index("unit_structure_correction_shard_claim_idx").on(
			table.phase,
			table.completedAt,
			table.leaseExpiresAt,
			table.jobId,
			table.shard,
		),
		check(
			"unit_structure_correction_shard_phase_check",
			inArray(table.phase, UnitStructureCorrectionShardPhaseValues),
		),
		check(
			"unit_structure_correction_shard_number_check",
			sql`${table.shard} between 0 and ${UnitStructureCorrectionShardCount - 1}`,
		),
		check(
			"unit_structure_correction_shard_lease_shape_check",
			sql`(${table.leaseOwner} is null
				and ${table.leaseToken} is null
				and ${table.leaseExpiresAt} is null)
				or (${table.leaseOwner} is not null
					and ${table.leaseToken} is not null
					and ${table.leaseExpiresAt} is not null)`,
		),
		check("unit_structure_correction_shard_count_check", sql`${table.processedCount} >= 0`),
	],
);

/** Disjoint old+target Tag reservation; it keeps parallel staging jobs composable. */
export const unitStructureCorrectionTagReservation = pgTable(
	"unit_structure_correction_tag_reservation",
	{
		tagId: uuid()
			.primaryKey()
			.references(() => tag.id, { onDelete: "restrict" }),
		jobId: uuid()
			.notNull()
			.references(() => unitStructureCorrection.id, { onDelete: "cascade" }),
		reservationEpoch: bigint({ mode: "bigint" }).notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		index("unit_structure_correction_tag_reservation_job_idx").on(table.jobId, table.tagId),
		check(
			"unit_structure_correction_tag_reservation_epoch_check",
			sql`${table.reservationEpoch} > 0`,
		),
	],
);

/** Affected target Unit discovered by staging; used for merge/delete cancellation. */
export const unitStructureCorrectionUnitReservation = pgTable(
	"unit_structure_correction_unit_reservation",
	{
		jobId: uuid()
			.notNull()
			.references(() => unitStructureCorrection.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.jobId, table.unitId] }),
		index("unit_structure_correction_unit_reservation_unit_idx").on(table.unitId, table.jobId),
	],
);

/** Exact base/target state for one effective Profile/Unit/Tag identity. */
export const unitStructureCorrectionEffectiveVote = pgTable(
	"unit_structure_correction_effective_vote",
	{
		jobId: uuid()
			.notNull()
			.references(() => unitStructureCorrection.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		baseValue: integer(),
		targetValue: integer(),
		baseApplied: boolean().default(false).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.jobId, table.unitId, table.tagId, table.profileId] }),
		index("unit_structure_correction_effective_vote_point_idx").on(
			table.unitId,
			table.tagId,
			table.jobId,
			table.profileId,
		),
		index("unit_structure_correction_effective_vote_compact_idx").on(
			table.jobId,
			table.baseApplied,
			table.unitId,
			table.tagId,
			table.profileId,
		),
		check(
			"unit_structure_correction_effective_vote_base_check",
			sql`${table.baseValue} is null or ${table.baseValue} in (-1, 1)`,
		),
		check(
			"unit_structure_correction_effective_vote_target_check",
			sql`${table.targetValue} is null or ${table.targetValue} in (-1, 1)`,
		),
		check(
			"unit_structure_correction_effective_vote_changed_check",
			sql`${table.baseValue} is distinct from ${table.targetValue}`,
		),
	],
);

/** Full base/target context and aggregate state for one changed Unit/Tag key. */
export const unitStructureCorrectionTagProjection = pgTable(
	"unit_structure_correction_tag_projection",
	{
		jobId: uuid()
			.notNull()
			.references(() => unitStructureCorrection.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
		basePresent: boolean().notNull(),
		targetPresent: boolean().notNull(),
		baseDirect: boolean().notNull(),
		targetDirect: boolean().notNull(),
		baseStructureSupportCount: bigint({ mode: "bigint" }).notNull(),
		targetStructureSupportCount: bigint({ mode: "bigint" }).notNull(),
		baseScore: bigint({ mode: "bigint" }).notNull(),
		targetScore: bigint({ mode: "bigint" }).notNull(),
		baseVoteCount: bigint({ mode: "bigint" }).notNull(),
		targetVoteCount: bigint({ mode: "bigint" }).notNull(),
		baseSpoilerVoteCount: bigint({ mode: "bigint" }).notNull(),
		targetSpoilerVoteCount: bigint({ mode: "bigint" }).notNull(),
		baseSpoilerNoneCount: bigint({ mode: "bigint" }).notNull(),
		targetSpoilerNoneCount: bigint({ mode: "bigint" }).notNull(),
		baseSpoilerMinorCount: bigint({ mode: "bigint" }).notNull(),
		targetSpoilerMinorCount: bigint({ mode: "bigint" }).notNull(),
		baseSpoilerMajorCount: bigint({ mode: "bigint" }).notNull(),
		targetSpoilerMajorCount: bigint({ mode: "bigint" }).notNull(),
		baseApplied: boolean().default(false).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.jobId, table.unitId, table.tagId] }),
		index("unit_structure_correction_tag_projection_point_idx").on(
			table.unitId,
			table.tagId,
			table.jobId,
		),
		index("unit_structure_correction_tag_projection_compact_idx").on(
			table.jobId,
			table.baseApplied,
			table.unitId,
			table.tagId,
		),
		check(
			"unit_structure_correction_tag_projection_count_check",
			sql`${table.baseStructureSupportCount} >= 0
				and ${table.targetStructureSupportCount} >= 0
				and ${table.baseVoteCount} >= 0
				and ${table.targetVoteCount} >= 0
				and ${table.baseSpoilerVoteCount} >= 0
				and ${table.targetSpoilerVoteCount} >= 0
				and ${table.baseSpoilerNoneCount} >= 0
				and ${table.targetSpoilerNoneCount} >= 0
				and ${table.baseSpoilerMinorCount} >= 0
				and ${table.targetSpoilerMinorCount} >= 0
				and ${table.baseSpoilerMajorCount} >= 0
				and ${table.targetSpoilerMajorCount} >= 0`,
		),
		check(
			"unit_structure_correction_tag_projection_score_check",
			sql`abs(${table.baseScore}) <= ${table.baseVoteCount}
				and abs(${table.targetScore}) <= ${table.targetVoteCount}`,
		),
		check(
			"unit_structure_correction_tag_projection_parity_check",
			sql`(${table.baseVoteCount} + ${table.baseScore}) % 2 = 0
				and (${table.targetVoteCount} + ${table.targetScore}) % 2 = 0`,
		),
		check(
			"unit_structure_correction_tag_projection_spoiler_count_check",
			sql`${table.baseSpoilerVoteCount} = ${table.baseSpoilerNoneCount}
					+ ${table.baseSpoilerMinorCount} + ${table.baseSpoilerMajorCount}
				and ${table.targetSpoilerVoteCount} = ${table.targetSpoilerNoneCount}
					+ ${table.targetSpoilerMinorCount} + ${table.targetSpoilerMajorCount}`,
		),
		check(
			"unit_structure_correction_tag_projection_presence_check",
			sql`${table.basePresent} = (${table.baseDirect} or ${table.baseStructureSupportCount} > 0)
				and ${table.targetPresent} =
					(${table.targetDirect} or ${table.targetStructureSupportCount} > 0)`,
		),
	],
);

/** Old/new leaf selection staged before the atomic projection pointer flip. */
export const unitStructureCorrectionPrimaryPath = pgTable(
	"unit_structure_correction_primary_path",
	{
		jobId: uuid()
			.notNull()
			.references(() => unitStructureCorrection.id, { onDelete: "cascade" }),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
		baseStructureId: uuid().references(() => unitStructure.id, { onDelete: "restrict" }),
		baseProjectionVersion: integer(),
		targetStructureId: uuid().references(() => unitStructure.id, { onDelete: "restrict" }),
		targetProjectionVersion: integer(),
		baseApplied: boolean().default(false).notNull(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.jobId, table.tagId] }),
		index("unit_structure_correction_primary_path_point_idx").on(table.tagId, table.jobId),
		check(
			"unit_structure_correction_primary_path_base_shape_check",
			sql`(${table.baseStructureId} is null) = (${table.baseProjectionVersion} is null)`,
		),
		check(
			"unit_structure_correction_primary_path_target_shape_check",
			sql`(${table.targetStructureId} is null) = (${table.targetProjectionVersion} is null)`,
		),
	],
);

/** Singleton, stealable activation/route-switch fence. */
export const unitStructureCorrectionActivation = pgTable(
	"unit_structure_correction_activation",
	{
		id: boolean().primaryKey().default(true),
		jobId: uuid().references(() => unitStructureCorrection.id, { onDelete: "restrict" }),
		leaseOwner: text(),
		leaseToken: uuid(),
		leaseExpiresAt: createTimestampMsColumn(),
		routingEpoch: bigint({ mode: "bigint" }).default(1n).notNull(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("unit_structure_correction_activation_job_key").on(table.jobId),
		check("unit_structure_correction_activation_singleton_check", sql`${table.id}`),
		check(
			"unit_structure_correction_activation_lease_shape_check",
			sql`(${table.jobId} is null
				and ${table.leaseOwner} is null
				and ${table.leaseToken} is null
				and ${table.leaseExpiresAt} is null)
				or (${table.jobId} is not null
					and ${table.leaseOwner} is not null
					and ${table.leaseToken} is not null
					and ${table.leaseExpiresAt} is not null)`,
		),
		check("unit_structure_correction_activation_epoch_check", sql`${table.routingEpoch} > 0`),
	],
);

// Canonical PostgreSQL owns these security-barrier view definitions. They are
// read boundaries only; every FK and mutation continues to target a base table.
export const currentUnitStructureMember = snakeCase
	.view("current_unit_structure_member", {
		structureId: uuid().notNull(),
		projectionVersion: integer().notNull(),
		ordinal: integer().notNull(),
		memberUnitId: uuid().notNull(),
	})
	.existing();

export const currentUnitStructureEdge = snakeCase
	.view("current_unit_structure_edge", {
		structureId: uuid().notNull(),
		projectionVersion: integer().notNull(),
		ordinal: integer().notNull(),
		parentUnitId: uuid().notNull(),
		childUnitId: uuid().notNull(),
	})
	.existing();

export const currentUnitStructureEnd = snakeCase
	.view("current_unit_structure_end", {
		structureId: uuid().notNull(),
		projectionVersion: integer().notNull(),
		finalTagId: uuid().notNull(),
	})
	.existing();

export const currentUnitStructurePrimaryPathCandidate = snakeCase
	.view("current_unit_structure_primary_path_candidate", {
		structureId: uuid().notNull(),
		projectionVersion: integer().notNull(),
		finalTagId: uuid().notNull(),
		accepted: boolean().notNull(),
		wilsonLowerBound: doublePrecision().notNull(),
		score: bigint({ mode: "bigint" }).notNull(),
		voteCount: bigint({ mode: "bigint" }).notNull(),
		updatedAt: createTimestampMsColumn().notNull(),
	})
	.existing();

export const currentUnitTagStructureSupport = snakeCase
	.view("current_unit_tag_structure_support", {
		unitId: uuid().notNull(),
		tagId: uuid().notNull(),
		profileId: uuid().notNull(),
		structureId: uuid().notNull(),
		projectionVersion: integer().notNull(),
		createdAt: createTimestampMsColumn().notNull(),
	})
	.existing();

export const currentUnitEffectiveTag = snakeCase
	.view("current_unit_effective_tag", {
		unitId: uuid().notNull(),
		tagId: uuid().notNull(),
		direct: boolean().notNull(),
		structureSupportCount: bigint({ mode: "bigint" }).notNull(),
		createdAt: createTimestampMsColumn().notNull(),
		updatedAt: createTimestampMsColumn().notNull(),
	})
	.existing();

export const currentUnitEffectiveTagVote = snakeCase
	.view("current_unit_effective_tag_vote", {
		unitId: uuid().notNull(),
		tagId: uuid().notNull(),
		profileId: uuid().notNull(),
		value: integer().notNull(),
		createdAt: createTimestampMsColumn().notNull(),
		updatedAt: createTimestampMsColumn().notNull(),
	})
	.existing();

export const currentUnitTagJudgmentStat = snakeCase
	.view("current_unit_tag_judgment_stat", {
		unitId: uuid().notNull(),
		tagId: uuid().notNull(),
		score: bigint({ mode: "bigint" }).notNull(),
		voteCount: bigint({ mode: "bigint" }).notNull(),
		spoilerVoteCount: bigint({ mode: "bigint" }).notNull(),
		spoilerNoneCount: bigint({ mode: "bigint" }).notNull(),
		spoilerMinorCount: bigint({ mode: "bigint" }).notNull(),
		spoilerMajorCount: bigint({ mode: "bigint" }).notNull(),
		updatedAt: createTimestampMsColumn().notNull(),
	})
	.existing();

export const currentTagPrimaryDisplayPath = snakeCase
	.view("current_tag_primary_display_path", {
		tagId: uuid().notNull(),
		structureId: uuid().notNull(),
		structureProjectionVersion: integer().notNull(),
		createdAt: createTimestampMsColumn().notNull(),
		updatedAt: createTimestampMsColumn().notNull(),
	})
	.existing();
