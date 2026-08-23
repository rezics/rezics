import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	doublePrecision,
	foreignKey,
	index,
	integer,
	smallint,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { type UnitStructureKind, UnitStructureKindValues } from "./contract-values";
import {
	createCreatedAtColumn,
	createFractionalIndexPositionByteLengthConstraint,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	fractionalIndexPosition,
} from "./columns";
import { profile } from "./profile";
import { unit } from "./unit";
import { tag } from "./tag";

export const UnitStructureDefinitionVersion = 1 as const;
export const UnitStructureMinimumMembers = 2 as const;
export const UnitStructureMaximumMembers = 16 as const;

/**
 * Community-immutable ordered Unit-path definition.
 *
 * `memberUnitIds` is the collision-free definition identity. Member and edge
 * rows are database-maintained projections that provide referential integrity
 * and inverse indexes without weakening exact-path deduplication. Only a
 * platform-authorized, audited correction flow may replace this definition.
 */
export const unitStructure = pgTable(
	"unit_structure",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		kind: text().$type<UnitStructureKind>().notNull(),
		definitionVersion: integer().default(UnitStructureDefinitionVersion).notNull(),
		memberUnitIds: uuid().array().notNull(),
		activeProjectionVersion: integer().default(1).notNull(),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("unit_structure_definition_key").on(
			table.kind,
			table.definitionVersion,
			table.memberUnitIds,
		),
		index("unit_structure_created_by_idx").on(table.createdByProfileId, table.createdAt),
		check("unit_structure_kind_check", inArray(table.kind, UnitStructureKindValues)),
		check(
			"unit_structure_definition_version_check",
			sql`${table.definitionVersion} = ${UnitStructureDefinitionVersion}`,
		),
		check(
			"unit_structure_active_projection_version_check",
			sql`${table.activeProjectionVersion} > 0`,
		),
		check(
			"unit_structure_member_count_check",
			sql`cardinality(${table.memberUnitIds}) between ${UnitStructureMinimumMembers} and ${UnitStructureMaximumMembers}`,
		),
		check(
			"unit_structure_member_null_check",
			sql`array_position(${table.memberUnitIds}, null) is null`,
		),
		check("unit_structure_not_self_check", sql`not (${table.id} = any(${table.memberUnitIds}))`),
	],
);

/** Referential and inverse-index projection of one community-immutable definition. */
export const unitStructureMember = pgTable(
	"unit_structure_member",
	{
		structureId: uuid()
			.notNull()
			.references(() => unitStructure.id, { onDelete: "cascade" }),
		projectionVersion: integer().default(1).notNull(),
		ordinal: integer().notNull(),
		memberUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
	},
	(table) => [
		primaryKey({ columns: [table.structureId, table.projectionVersion, table.ordinal] }),
		unique("unit_structure_member_structure_projection_member_key").on(
			table.structureId,
			table.projectionVersion,
			table.memberUnitId,
		),
		index("unit_structure_member_unit_idx").on(
			table.memberUnitId,
			table.structureId,
			table.ordinal,
		),
		check("unit_structure_member_projection_version_check", sql`${table.projectionVersion} > 0`),
		check("unit_structure_member_ordinal_check", sql`${table.ordinal} >= 0`),
	],
);

/**
 * Narrow inverse projection of the final Tag in one immutable Path.
 *
 * The database-maintained definition projection makes primary-path refreshes
 * proportional only to Paths ending at one Tag.
 */
export const unitStructureEnd = pgTable(
	"unit_structure_end",
	{
		structureId: uuid()
			.notNull()
			.references(() => unitStructure.id, { onDelete: "cascade" }),
		projectionVersion: integer().default(1).notNull(),
		finalTagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
	},
	(table) => [
		primaryKey({ columns: [table.structureId, table.projectionVersion] }),
		unique("unit_structure_end_structure_projection_tag_key").on(
			table.structureId,
			table.projectionVersion,
			table.finalTagId,
		),
		index("unit_structure_end_tag_idx").on(
			table.finalTagId,
			table.structureId,
			table.projectionVersion,
		),
		check("unit_structure_end_projection_version_check", sql`${table.projectionVersion} > 0`),
	],
);

/** Rank-indexed primary-Path candidate for one Structure projection generation. */
export const unitStructurePrimaryPathCandidate = pgTable(
	"unit_structure_primary_path_candidate",
	{
		structureId: uuid().notNull(),
		projectionVersion: integer().notNull(),
		finalTagId: uuid().notNull(),
		accepted: boolean().default(false).notNull(),
		wilsonLowerBound: doublePrecision().default(0).notNull(),
		score: bigint({ mode: "bigint" }).default(0n).notNull(),
		voteCount: bigint({ mode: "bigint" }).default(0n).notNull(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.structureId, table.projectionVersion] }),
		foreignKey({
			columns: [table.structureId, table.projectionVersion, table.finalTagId],
			foreignColumns: [
				unitStructureEnd.structureId,
				unitStructureEnd.projectionVersion,
				unitStructureEnd.finalTagId,
			],
			name: "unit_structure_primary_path_candidate_end_fkey",
		}).onDelete("cascade"),
		index("unit_structure_primary_path_candidate_rank_idx")
			.on(
				table.finalTagId,
				table.wilsonLowerBound.desc(),
				table.score.desc(),
				table.voteCount.desc(),
				table.structureId,
				table.projectionVersion,
			)
			.where(sql`${table.accepted}`),
		check(
			"unit_structure_primary_path_candidate_projection_version_check",
			sql`${table.projectionVersion} > 0`,
		),
		check("unit_structure_primary_path_candidate_count_check", sql`${table.voteCount} >= 0`),
		check(
			"unit_structure_primary_path_candidate_score_check",
			sql`abs(${table.score}) <= ${table.voteCount}`,
		),
		check(
			"unit_structure_primary_path_candidate_parity_check",
			sql`(${table.voteCount} + ${table.score}) % 2 = 0`,
		),
		check(
			"unit_structure_primary_path_candidate_acceptance_check",
			sql`${table.accepted} = (${table.score} > 0 and ${table.voteCount} > 0)`,
		),
		check(
			"unit_structure_primary_path_candidate_wilson_check",
			sql`${table.wilsonLowerBound} between 0 and 1`,
		),
	],
);

/** Exactly one rebuildable primary display Path for each accepted leaf Tag. */
export const tagPrimaryDisplayPath = pgTable(
	"tag_primary_display_path",
	{
		tagId: uuid()
			.primaryKey()
			.references(() => tag.id, { onDelete: "cascade" }),
		structureId: uuid().notNull(),
		structureProjectionVersion: integer().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.structureId, table.structureProjectionVersion, table.tagId],
			foreignColumns: [
				unitStructureEnd.structureId,
				unitStructureEnd.projectionVersion,
				unitStructureEnd.finalTagId,
			],
			name: "tag_primary_display_path_structure_end_fkey",
		}).onDelete("cascade"),
		index("tag_primary_display_path_structure_idx").on(
			table.structureId,
			table.structureProjectionVersion,
			table.tagId,
		),
		check(
			"tag_primary_display_path_projection_version_check",
			sql`${table.structureProjectionVersion} > 0`,
		),
	],
);

/** Adjacent-pair projection used for one-hop and fixed two-hop structure navigation. */
export const unitStructureEdge = pgTable(
	"unit_structure_edge",
	{
		structureId: uuid()
			.notNull()
			.references(() => unitStructure.id, { onDelete: "cascade" }),
		projectionVersion: integer().default(1).notNull(),
		ordinal: integer().notNull(),
		parentUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		childUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
	},
	(table) => [
		primaryKey({ columns: [table.structureId, table.projectionVersion, table.ordinal] }),
		index("unit_structure_edge_parent_idx").on(
			table.parentUnitId,
			table.childUnitId,
			table.structureId,
		),
		index("unit_structure_edge_child_idx").on(
			table.childUnitId,
			table.parentUnitId,
			table.structureId,
		),
		check("unit_structure_edge_not_self_check", sql`${table.parentUnitId} <> ${table.childUnitId}`),
		check("unit_structure_edge_projection_version_check", sql`${table.projectionVersion} > 0`),
		check("unit_structure_edge_ordinal_check", sql`${table.ordinal} >= 0`),
	],
);

/**
 * Global community judgment of an immutable structure definition.
 *
 * @todo Add Realm-scoped definition votes as a separate authority and
 * aggregate. They must never be merged into this global score.
 */
export const unitStructureVote = pgTable(
	"unit_structure_vote",
	{
		structureId: uuid()
			.notNull()
			.references(() => unitStructure.id, { onDelete: "restrict" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		value: integer().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.structureId, table.profileId] }),
		index("unit_structure_vote_profile_idx").on(table.profileId, table.structureId),
		check("unit_structure_vote_value_check", sql`${table.value} in (-1, 1)`),
	],
);

/** Global, community-voted application of a Structure Unit to another Unit. */
export const unitStructureApplication = pgTable(
	"unit_structure_application",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		structureId: uuid()
			.notNull()
			.references(() => unitStructure.id, { onDelete: "cascade" }),
		createdByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		pinned: boolean().default(false).notNull(),
		position: fractionalIndexPosition(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.structureId] }),
		index("unit_structure_application_structure_idx").on(table.structureId, table.unitId),
		index("unit_structure_application_unit_position_idx").on(
			table.unitId,
			table.pinned,
			table.position,
			table.structureId,
		),
		check(
			"unit_structure_application_not_self_check",
			sql`${table.unitId} <> ${table.structureId}`,
		),
		createFractionalIndexPositionByteLengthConstraint(
			"unit_structure_application_position_byte_length_check",
			table.position,
		),
	],
);

/**
 * Global judgment that a Structure Unit applies to a target Unit.
 *
 * @todo Add Realm-scoped application votes and provenance without changing
 * the meaning of these global votes or their effective-Tag projection.
 */
export const unitStructureApplicationJudgment = pgTable(
	"unit_structure_application_judgment",
	{
		unitId: uuid().notNull(),
		structureId: uuid().notNull(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		fitVote: integer(),
		spoilerLevel: smallint(),
		fitUpdatedAt: createTimestampMsColumn(),
		spoilerUpdatedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.structureId, table.profileId] }),
		foreignKey({
			columns: [table.unitId, table.structureId],
			foreignColumns: [unitStructureApplication.unitId, unitStructureApplication.structureId],
			name: "unit_structure_application_judgment_application_fkey",
		}).onDelete("restrict"),
		index("unit_structure_application_judgment_profile_idx").on(
			table.profileId,
			table.unitId,
			table.structureId,
		),
		index("unit_structure_application_judgment_structure_idx").on(
			table.structureId,
			table.unitId,
			table.profileId,
		),
		index("unit_structure_application_judgment_positive_structure_idx")
			.on(table.structureId, table.unitId, table.profileId)
			.where(sql`${table.fitVote} = 1`),
		check(
			"unit_structure_application_judgment_fit_vote_check",
			sql`${table.fitVote} is null or ${table.fitVote} in (-1, 1)`,
		),
		check(
			"unit_structure_application_judgment_spoiler_level_check",
			sql`${table.spoilerLevel} is null or ${table.spoilerLevel} between 0 and 2`,
		),
		check(
			"unit_structure_application_judgment_sparse_check",
			sql`${table.fitVote} is not null or ${table.spoilerLevel} is not null`,
		),
		check(
			"unit_structure_application_judgment_fit_timestamp_check",
			sql`(${table.fitVote} is null) = (${table.fitUpdatedAt} is null)`,
		),
		check(
			"unit_structure_application_judgment_spoiler_timestamp_check",
			sql`(${table.spoilerLevel} is null) = (${table.spoilerUpdatedAt} is null)`,
		),
	],
);

/**
 * Provenance row for one positive Structure application contributing support
 * to one member Tag. Multiple paths remain distinct here and collapse in the
 * effective-vote projection.
 */
export const unitTagStructureSupport = pgTable(
	"unit_tag_structure_support",
	{
		unitId: uuid().notNull(),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
		profileId: uuid().notNull(),
		structureId: uuid().notNull(),
		projectionVersion: integer().default(1).notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({
			columns: [
				table.unitId,
				table.tagId,
				table.profileId,
				table.structureId,
				table.projectionVersion,
			],
		}),
		foreignKey({
			columns: [table.unitId, table.structureId, table.profileId],
			foreignColumns: [
				unitStructureApplicationJudgment.unitId,
				unitStructureApplicationJudgment.structureId,
				unitStructureApplicationJudgment.profileId,
			],
			name: "unit_tag_structure_support_application_judgment_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.structureId, table.projectionVersion, table.tagId],
			foreignColumns: [
				unitStructureMember.structureId,
				unitStructureMember.projectionVersion,
				unitStructureMember.memberUnitId,
			],
			name: "unit_tag_structure_support_member_fkey",
		}).onDelete("cascade"),
		index("unit_tag_structure_support_effective_vote_idx").on(
			table.unitId,
			table.tagId,
			table.profileId,
		),
		index("unit_tag_structure_support_member_idx").on(
			table.structureId,
			table.projectionVersion,
			table.tagId,
			table.unitId,
			table.profileId,
		),
		index("unit_tag_structure_support_application_judgment_idx").on(
			table.unitId,
			table.structureId,
			table.profileId,
			table.projectionVersion,
			table.tagId,
		),
		check(
			"unit_tag_structure_support_projection_version_check",
			sql`${table.projectionVersion} > 0`,
		),
	],
);

/** Rebuildable union of direct Tag contexts and Structure-derived Tag support. */
export const unitEffectiveTag = pgTable(
	"unit_effective_tag",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
		direct: boolean().default(false).notNull(),
		structureSupportCount: bigint({ mode: "bigint" }).default(0n).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.tagId] }),
		index("unit_effective_tag_tag_idx").on(table.tagId, table.unitId),
		check(
			"unit_effective_tag_source_check",
			sql`${table.direct} or ${table.structureSupportCount} > 0`,
		),
		check("unit_effective_tag_not_self_check", sql`${table.unitId} <> ${table.tagId}`),
		check("unit_effective_tag_structure_count_check", sql`${table.structureSupportCount} >= 0`),
	],
);

/** One Profile's deduplicated effective global Tag judgment. */
export const unitEffectiveTagVote = pgTable(
	"unit_effective_tag_vote",
	{
		unitId: uuid().notNull(),
		tagId: uuid().notNull(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		value: integer().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.tagId, table.profileId] }),
		foreignKey({
			columns: [table.unitId, table.tagId],
			foreignColumns: [unitEffectiveTag.unitId, unitEffectiveTag.tagId],
			name: "unit_effective_tag_vote_effective_tag_fkey",
		}).onDelete("cascade"),
		index("unit_effective_tag_vote_profile_idx").on(table.profileId, table.unitId),
		check("unit_effective_tag_vote_value_check", sql`${table.value} in (-1, 1)`),
	],
);
