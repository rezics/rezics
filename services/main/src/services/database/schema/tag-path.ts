import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	smallint,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createFractionalIndexPositionByteLengthConstraint,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
} from "./columns";
import { profile } from "./profile";
import { realm, realmUnit } from "./realm";
import { tag } from "./tag";
import { unit } from "./unit";

export const TagPathMinimumMembers = 2 as const;
export const TagPathMaximumMembers = 16 as const;

export const TagPathMergeStatusValues = ["proposed", "accepted", "rejected", "reversed"] as const;
export type TagPathMergeStatus = (typeof TagPathMergeStatusValues)[number];
export const TagPathMergeProposalSourceKindValues = ["human", "assisted"] as const;
export type TagPathMergeProposalSourceKind = (typeof TagPathMergeProposalSourceKindValues)[number];
export type TagPathAssistanceProvenance = {
	readonly kind: "assisted";
	readonly system: string;
	readonly runId: string;
	readonly model?: string;
	readonly confidence?: number;
};

/** Immutable Tag-domain hierarchy Path. */
export const tagPath = pgTable(
	"tag_path",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		memberTagIds: uuid().array().notNull(),
		terminalTagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("tag_path_definition_key").on(table.memberTagIds),
		index("tag_path_terminal_usage_idx").on(table.terminalTagId, table.id),
		index("tag_path_created_by_idx").on(table.createdByProfileId, table.createdAt, table.id),
		check(
			"tag_path_member_count_check",
			sql`cardinality(${table.memberTagIds}) between ${TagPathMinimumMembers} and ${TagPathMaximumMembers}`,
		),
		check("tag_path_member_null_check", sql`array_position(${table.memberTagIds}, null) is null`),
		check(
			"tag_path_terminal_check",
			sql`${table.terminalTagId} = ${table.memberTagIds}[cardinality(${table.memberTagIds})]`,
		),
		check("tag_path_not_self_check", sql`not (${table.id} = any(${table.memberTagIds}))`),
	],
);

/** Searchable member projection of one immutable Path definition. */
export const tagPathMember = pgTable(
	"tag_path_member",
	{
		pathId: uuid()
			.notNull()
			.references(() => tagPath.id, { onDelete: "cascade" }),
		ordinal: integer().notNull(),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
	},
	(table) => [
		primaryKey({ columns: [table.pathId, table.ordinal] }),
		unique("tag_path_member_path_tag_key").on(table.pathId, table.tagId),
		index("tag_path_member_tag_path_idx").on(table.tagId, table.pathId, table.ordinal),
		check("tag_path_member_ordinal_check", sql`${table.ordinal} >= 0`),
	],
);

/** Rebuildable adjacent-pair projection for hierarchy navigation. */
export const tagPathEdge = pgTable(
	"tag_path_edge",
	{
		pathId: uuid()
			.notNull()
			.references(() => tagPath.id, { onDelete: "cascade" }),
		ordinal: integer().notNull(),
		parentTagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
		childTagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
	},
	(table) => [
		primaryKey({ columns: [table.pathId, table.ordinal] }),
		index("tag_path_edge_parent_idx").on(table.parentTagId, table.childTagId, table.pathId),
		index("tag_path_edge_child_idx").on(table.childTagId, table.parentTagId, table.pathId),
		check("tag_path_edge_not_self_check", sql`${table.parentTagId} <> ${table.childTagId}`),
		check("tag_path_edge_ordinal_check", sql`${table.ordinal} >= 0`),
	],
);

/** Global definition judgment for one immutable Path. */
export const tagPathVote = pgTable(
	"tag_path_vote",
	{
		pathId: uuid()
			.notNull()
			.references(() => tagPath.id, { onDelete: "restrict" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		value: integer().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.pathId, table.profileId] }),
		index("tag_path_vote_profile_idx").on(table.profileId, table.pathId),
		check("tag_path_vote_value_check", sql`${table.value} in (-1, 1)`),
	],
);

/** Global application of a Tag Path to one Unit. */
export const unitTagPath = pgTable(
	"unit_tag_path",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		pathId: uuid()
			.notNull()
			.references(() => tagPath.id, { onDelete: "cascade" }),
		createdByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		pinned: boolean().default(false).notNull(),
		position: fractionalIndexPosition(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.pathId] }),
		index("unit_tag_path_path_idx").on(table.pathId, table.unitId),
		index("unit_tag_path_unit_position_idx").on(
			table.unitId,
			table.pinned,
			table.position,
			table.pathId,
		),
		check("unit_tag_path_not_self_check", sql`${table.unitId} <> ${table.pathId}`),
		createFractionalIndexPositionByteLengthConstraint(
			"unit_tag_path_position_byte_length_check",
			table.position,
		),
	],
);

/** Sparse fit and spoiler judgment for a global Unit–Path application. */
export const unitTagPathJudgment = pgTable(
	"unit_tag_path_judgment",
	{
		unitId: uuid().notNull(),
		pathId: uuid().notNull(),
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
		primaryKey({ columns: [table.unitId, table.pathId, table.profileId] }),
		foreignKey({
			columns: [table.unitId, table.pathId],
			foreignColumns: [unitTagPath.unitId, unitTagPath.pathId],
			name: "unit_tag_path_judgment_application_fkey",
		}).onDelete("cascade"),
		index("unit_tag_path_judgment_profile_idx").on(table.profileId, table.unitId, table.pathId),
		index("unit_tag_path_judgment_path_idx").on(table.pathId, table.unitId, table.profileId),
		index("unit_tag_path_judgment_positive_path_idx")
			.on(table.pathId, table.unitId, table.profileId)
			.where(sql`${table.fitVote} = 1`),
		check(
			"unit_tag_path_judgment_fit_vote_check",
			sql`${table.fitVote} is null or ${table.fitVote} in (-1, 1)`,
		),
		check(
			"unit_tag_path_judgment_spoiler_level_check",
			sql`${table.spoilerLevel} is null or ${table.spoilerLevel} between 0 and 2`,
		),
		check(
			"unit_tag_path_judgment_sparse_check",
			sql`${table.fitVote} is not null or ${table.spoilerLevel} is not null`,
		),
		check(
			"unit_tag_path_judgment_fit_timestamp_check",
			sql`(${table.fitVote} is null) = (${table.fitUpdatedAt} is null)`,
		),
		check(
			"unit_tag_path_judgment_spoiler_timestamp_check",
			sql`(${table.spoilerLevel} is null) = (${table.spoilerUpdatedAt} is null)`,
		),
	],
);

/** Per-Profile provenance for Path-derived Tag support. */
export const unitTagPathSupport = pgTable(
	"unit_tag_path_support",
	{
		unitId: uuid().notNull(),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
		profileId: uuid().notNull(),
		pathId: uuid().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.tagId, table.profileId, table.pathId] }),
		foreignKey({
			columns: [table.unitId, table.pathId, table.profileId],
			foreignColumns: [
				unitTagPathJudgment.unitId,
				unitTagPathJudgment.pathId,
				unitTagPathJudgment.profileId,
			],
			name: "unit_tag_path_support_judgment_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.pathId, table.tagId],
			foreignColumns: [tagPathMember.pathId, tagPathMember.tagId],
			name: "unit_tag_path_support_member_fkey",
		}).onDelete("cascade"),
		index("unit_tag_path_support_effective_idx").on(table.unitId, table.tagId, table.profileId),
		index("unit_tag_path_support_path_idx").on(
			table.pathId,
			table.tagId,
			table.unitId,
			table.profileId,
		),
	],
);

/** Rebuildable union of direct and Path-derived global Tag contexts. */
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
		pathSupportCount: bigint({ mode: "bigint" }).default(0n).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.tagId] }),
		index("unit_effective_tag_tag_idx").on(table.tagId, table.unitId),
		check("unit_effective_tag_source_check", sql`${table.direct} or ${table.pathSupportCount} > 0`),
		check("unit_effective_tag_not_self_check", sql`${table.unitId} <> ${table.tagId}`),
		check("unit_effective_tag_path_count_check", sql`${table.pathSupportCount} >= 0`),
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

/** Audited manual governance convergence between immutable Path Units. */
export const tagPathMerge = pgTable(
	"tag_path_merge",
	{
		id: createUuidv7PrimaryKey(),
		sourcePathId: uuid()
			.notNull()
			.references(() => tagPath.id, { onDelete: "restrict" }),
		targetPathId: uuid()
			.notNull()
			.references(() => tagPath.id, { onDelete: "restrict" }),
		status: text().$type<TagPathMergeStatus>().default("proposed").notNull(),
		reason: text().notNull(),
		proposalSourceKind: text().$type<TagPathMergeProposalSourceKind>().default("human").notNull(),
		proposalProvenance: createJsonObjectColumn<TagPathAssistanceProvenance>(),
		proposedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		resolvedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		resolvedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("tag_path_merge_accepted_source_idx")
			.on(table.sourcePathId)
			.where(sql`${table.status} = 'accepted'`),
		index("tag_path_merge_target_status_idx").on(table.targetPathId, table.status, table.id),
		index("tag_path_merge_queue_idx").on(table.status, table.createdAt, table.id),
		check("tag_path_merge_status_check", inArray(table.status, TagPathMergeStatusValues)),
		check(
			"tag_path_merge_proposal_source_kind_check",
			inArray(table.proposalSourceKind, TagPathMergeProposalSourceKindValues),
		),
		createJsonObjectConstraint(
			"tag_path_merge_proposal_provenance_object_check",
			table.proposalProvenance,
		),
		check(
			"tag_path_merge_proposal_provenance_check",
			sql`(
				${table.proposalSourceKind} = 'human' and ${table.proposalProvenance} is null
			) or (
				${table.proposalSourceKind} = 'assisted'
				and ${table.proposalProvenance}->>'kind' = 'assisted'
				and jsonb_typeof(${table.proposalProvenance}->'system') = 'string'
				and btrim(${table.proposalProvenance}->>'system') <> ''
				and jsonb_typeof(${table.proposalProvenance}->'runId') = 'string'
				and btrim(${table.proposalProvenance}->>'runId') <> ''
				and (
					not (${table.proposalProvenance} ? 'model')
					or jsonb_typeof(${table.proposalProvenance}->'model') = 'string'
				)
				and (
					not (${table.proposalProvenance} ? 'confidence')
					or (
						jsonb_typeof(${table.proposalProvenance}->'confidence') = 'number'
						and (${table.proposalProvenance}->>'confidence')::numeric between 0 and 1
					)
				)
			)`,
		),
		check("tag_path_merge_distinct_check", sql`${table.sourcePathId} <> ${table.targetPathId}`),
		check("tag_path_merge_reason_check", sql`btrim(${table.reason}) <> ''`),
		check(
			"tag_path_merge_resolution_check",
			sql`(${table.status} = 'proposed') = (${table.resolvedAt} is null and ${table.resolvedByProfileId} is null)`,
		),
	],
);

/** One Realm's adoption of a global immutable Path definition. */
export const realmTagPath = pgTable(
	"realm_tag_path",
	{
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		pathId: uuid()
			.notNull()
			.references(() => tagPath.id, { onDelete: "restrict" }),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.pathId] }),
		index("realm_tag_path_path_realm_idx").on(table.pathId, table.realmId),
	],
);

export const realmTagPathVote = pgTable(
	"realm_tag_path_vote",
	{
		realmId: uuid().notNull(),
		pathId: uuid().notNull(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		value: integer().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.pathId, table.profileId] }),
		foreignKey({
			columns: [table.realmId, table.pathId],
			foreignColumns: [realmTagPath.realmId, realmTagPath.pathId],
			name: "realm_tag_path_vote_adoption_fkey",
		}).onDelete("cascade"),
		index("realm_tag_path_vote_profile_idx").on(table.profileId, table.realmId, table.pathId),
		check("realm_tag_path_vote_value_check", sql`${table.value} in (-1, 1)`),
	],
);

export const realmUnitTagPath = pgTable(
	"realm_unit_tag_path",
	{
		realmId: uuid().notNull(),
		unitId: uuid().notNull(),
		pathId: uuid().notNull(),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.unitId, table.pathId] }),
		foreignKey({
			columns: [table.realmId, table.unitId],
			foreignColumns: [realmUnit.realmId, realmUnit.unitId],
			name: "realm_unit_tag_path_realm_unit_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.realmId, table.pathId],
			foreignColumns: [realmTagPath.realmId, realmTagPath.pathId],
			name: "realm_unit_tag_path_adoption_fkey",
		}).onDelete("restrict"),
		index("realm_unit_tag_path_path_idx").on(table.realmId, table.pathId, table.unitId),
		index("realm_unit_tag_path_unit_route_idx").on(table.unitId, table.realmId, table.pathId),
	],
);

export const realmUnitTagPathJudgment = pgTable(
	"realm_unit_tag_path_judgment",
	{
		realmId: uuid().notNull(),
		unitId: uuid().notNull(),
		pathId: uuid().notNull(),
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
		primaryKey({ columns: [table.realmId, table.unitId, table.pathId, table.profileId] }),
		foreignKey({
			columns: [table.realmId, table.unitId, table.pathId],
			foreignColumns: [realmUnitTagPath.realmId, realmUnitTagPath.unitId, realmUnitTagPath.pathId],
			name: "realm_unit_tag_path_judgment_application_fkey",
		}).onDelete("cascade"),
		index("realm_unit_tag_path_judgment_profile_idx").on(
			table.profileId,
			table.realmId,
			table.unitId,
			table.pathId,
		),
		index("realm_unit_tag_path_judgment_path_idx").on(
			table.pathId,
			table.realmId,
			table.unitId,
			table.profileId,
		),
		check(
			"realm_unit_tag_path_judgment_fit_vote_check",
			sql`${table.fitVote} is null or ${table.fitVote} in (-1, 1)`,
		),
		check(
			"realm_unit_tag_path_judgment_spoiler_level_check",
			sql`${table.spoilerLevel} is null or ${table.spoilerLevel} between 0 and 2`,
		),
		check(
			"realm_unit_tag_path_judgment_sparse_check",
			sql`${table.fitVote} is not null or ${table.spoilerLevel} is not null`,
		),
		check(
			"realm_unit_tag_path_judgment_fit_timestamp_check",
			sql`(${table.fitVote} is null) = (${table.fitUpdatedAt} is null)`,
		),
		check(
			"realm_unit_tag_path_judgment_spoiler_timestamp_check",
			sql`(${table.spoilerLevel} is null) = (${table.spoilerUpdatedAt} is null)`,
		),
	],
);

export const realmUnitTagPathSupport = pgTable(
	"realm_unit_tag_path_support",
	{
		realmId: uuid().notNull(),
		unitId: uuid().notNull(),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
		profileId: uuid().notNull(),
		pathId: uuid().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({
			columns: [table.realmId, table.unitId, table.tagId, table.profileId, table.pathId],
		}),
		foreignKey({
			columns: [table.realmId, table.unitId, table.pathId, table.profileId],
			foreignColumns: [
				realmUnitTagPathJudgment.realmId,
				realmUnitTagPathJudgment.unitId,
				realmUnitTagPathJudgment.pathId,
				realmUnitTagPathJudgment.profileId,
			],
			name: "realm_unit_tag_path_support_judgment_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.pathId, table.tagId],
			foreignColumns: [tagPathMember.pathId, tagPathMember.tagId],
			name: "realm_unit_tag_path_support_member_fkey",
		}).onDelete("cascade"),
		index("realm_unit_tag_path_support_effective_idx").on(
			table.realmId,
			table.unitId,
			table.tagId,
			table.profileId,
		),
		index("realm_unit_tag_path_support_path_idx").on(
			table.pathId,
			table.realmId,
			table.unitId,
			table.tagId,
		),
	],
);

export const realmUnitEffectiveTag = pgTable(
	"realm_unit_effective_tag",
	{
		realmId: uuid().notNull(),
		unitId: uuid().notNull(),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
		direct: boolean().default(false).notNull(),
		pathSupportCount: bigint({ mode: "bigint" }).default(0n).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.unitId, table.tagId] }),
		foreignKey({
			columns: [table.realmId, table.unitId],
			foreignColumns: [realmUnit.realmId, realmUnit.unitId],
			name: "realm_unit_effective_tag_realm_unit_fkey",
		}).onDelete("cascade"),
		index("realm_unit_effective_tag_tag_idx").on(table.tagId, table.realmId, table.unitId),
		check(
			"realm_unit_effective_tag_source_check",
			sql`${table.direct} or ${table.pathSupportCount} > 0`,
		),
		check("realm_unit_effective_tag_path_count_check", sql`${table.pathSupportCount} >= 0`),
	],
);
