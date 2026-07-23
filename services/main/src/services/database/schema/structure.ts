import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { type UnitKind, type UnitStructureKind, UnitStructureKindValues } from "./contract-values";
import { createCreatedAtColumn, createUpdatedAtColumn, fractionalIndexPosition } from "./columns";
import { profile, unit } from "./core";
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
		id: uuid().primaryKey(),
		unitKind: text().$type<"structure">().default("structure").notNull(),
		kind: text().$type<UnitStructureKind>().notNull(),
		definitionVersion: integer().default(UnitStructureDefinitionVersion).notNull(),
		memberUnitIds: uuid().array().notNull(),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.id, table.unitKind],
			foreignColumns: [unit.id, unit.kind],
			name: "unit_structure_unit_kind_fkey",
		}).onDelete("cascade"),
		unique("unit_structure_definition_key").on(
			table.kind,
			table.definitionVersion,
			table.memberUnitIds,
		),
		index("unit_structure_created_by_idx").on(table.createdByProfileId, table.createdAt),
		check("unit_structure_unit_kind_check", sql`${table.unitKind} = 'structure'`),
		check("unit_structure_kind_check", inArray(table.kind, UnitStructureKindValues)),
		check(
			"unit_structure_definition_version_check",
			sql`${table.definitionVersion} = ${UnitStructureDefinitionVersion}`,
		),
		check(
			"unit_structure_member_count_check",
			sql`cardinality(${table.memberUnitIds}) between ${UnitStructureMinimumMembers} and ${UnitStructureMaximumMembers}`,
		),
		check(
			"unit_structure_member_null_check",
			sql`array_position(${table.memberUnitIds}, null) is null`,
		),
		check(
			"unit_structure_not_self_check",
			sql`not (${table.id} = any(${table.memberUnitIds}))`,
		),
	],
);

/** Referential and inverse-index projection of one community-immutable definition. */
export const unitStructureMember = pgTable(
	"unit_structure_member",
	{
		structureId: uuid()
			.notNull()
			.references(() => unitStructure.id, { onDelete: "cascade" }),
		ordinal: integer().notNull(),
		memberUnitId: uuid().notNull(),
		memberUnitKind: text().$type<UnitKind>().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.structureId, table.ordinal] }),
		unique("unit_structure_member_structure_member_key").on(
			table.structureId,
			table.memberUnitId,
		),
		foreignKey({
			columns: [table.memberUnitId, table.memberUnitKind],
			foreignColumns: [unit.id, unit.kind],
			name: "unit_structure_member_unit_kind_fkey",
		}).onDelete("restrict"),
		index("unit_structure_member_unit_idx").on(
			table.memberUnitId,
			table.structureId,
			table.ordinal,
		),
		check("unit_structure_member_ordinal_check", sql`${table.ordinal} >= 0`),
	],
);

/** Adjacent-pair projection used for one-hop and fixed two-hop structure navigation. */
export const unitStructureEdge = pgTable(
	"unit_structure_edge",
	{
		structureId: uuid()
			.notNull()
			.references(() => unitStructure.id, { onDelete: "cascade" }),
		ordinal: integer().notNull(),
		parentUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		childUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
	},
	(table) => [
		primaryKey({ columns: [table.structureId, table.ordinal] }),
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
		check(
			"unit_structure_edge_not_self_check",
			sql`${table.parentUnitId} <> ${table.childUnitId}`,
		),
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
			.references(() => unitStructure.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
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
	],
);

/**
 * Global judgment that a Structure Unit applies to a target Unit.
 *
 * @todo Add Realm-scoped application votes and provenance without changing
 * the meaning of these global votes or their effective-Tag projection.
 */
export const unitStructureApplicationVote = pgTable(
	"unit_structure_application_vote",
	{
		unitId: uuid().notNull(),
		structureId: uuid().notNull(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		value: integer().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.structureId, table.profileId] }),
		foreignKey({
			columns: [table.unitId, table.structureId],
			foreignColumns: [unitStructureApplication.unitId, unitStructureApplication.structureId],
			name: "unit_structure_application_vote_application_fkey",
		}).onDelete("cascade"),
		index("unit_structure_application_vote_profile_idx").on(table.profileId, table.unitId),
		check("unit_structure_application_vote_value_check", sql`${table.value} in (-1, 1)`),
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
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({
			columns: [table.unitId, table.tagId, table.profileId, table.structureId],
		}),
		foreignKey({
			columns: [table.unitId, table.structureId, table.profileId],
			foreignColumns: [
				unitStructureApplicationVote.unitId,
				unitStructureApplicationVote.structureId,
				unitStructureApplicationVote.profileId,
			],
			name: "unit_tag_structure_support_application_vote_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.structureId, table.tagId],
			foreignColumns: [unitStructureMember.structureId, unitStructureMember.memberUnitId],
			name: "unit_tag_structure_support_member_fkey",
		}).onDelete("cascade"),
		index("unit_tag_structure_support_effective_vote_idx").on(
			table.unitId,
			table.tagId,
			table.profileId,
		),
		index("unit_tag_structure_support_structure_idx").on(
			table.structureId,
			table.unitId,
			table.profileId,
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
