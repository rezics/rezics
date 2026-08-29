import { inArray, sql } from "drizzle-orm";
import {
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
import {
	tagExpression,
	TagExpressionArgumentRoleValues,
	type TagExpressionArgumentRole,
} from "./tag-expression";
import { tagRelation, vocabularyNode } from "./vocabulary";
import { unit } from "./unit";

export const TagPathMinimumMembers = 2 as const;
export const TagPathMaximumMembers = 16 as const;

export const TagPathLifecycleStatusValues = ["active", "retired"] as const;
export type TagPathLifecycleStatus = (typeof TagPathLifecycleStatusValues)[number];

export const TagPathSenseScopeValues = ["global", "realm"] as const;
export type TagPathSenseScope = (typeof TagPathSenseScopeValues)[number];

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
export type TagPathSenseProvenance = Readonly<Record<string, unknown>>;

/** Immutable vocabulary route. Identity is the ordered node and typed-relation sequence. */
export const tagPath = pgTable(
	"tag_path",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		memberNodeIds: uuid().array().notNull(),
		relationIds: uuid().array().notNull(),
		structuralIdentityHash: text().notNull(),
		terminalNodeId: uuid()
			.notNull()
			.references(() => vocabularyNode.id, { onDelete: "restrict" }),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("tag_path_structure_key").on(table.memberNodeIds, table.relationIds),
		unique("tag_path_structural_identity_hash_key").on(table.structuralIdentityHash),
		index("tag_path_terminal_usage_idx").on(table.terminalNodeId, table.id),
		index("tag_path_created_by_idx").on(table.createdByProfileId, table.createdAt, table.id),
		check(
			"tag_path_member_count_check",
			sql`cardinality(${table.memberNodeIds}) between ${TagPathMinimumMembers} and ${TagPathMaximumMembers}`,
		),
		check(
			"tag_path_relation_count_check",
			sql`cardinality(${table.relationIds}) = cardinality(${table.memberNodeIds}) - 1`,
		),
		check("tag_path_member_null_check", sql`array_position(${table.memberNodeIds}, null) is null`),
		check("tag_path_relation_null_check", sql`array_position(${table.relationIds}, null) is null`),
		check(
			"tag_path_terminal_check",
			sql`${table.terminalNodeId} = ${table.memberNodeIds}[cardinality(${table.memberNodeIds})]`,
		),
		check("tag_path_not_self_check", sql`not (${table.id} = any(${table.memberNodeIds}))`),
		check(
			"tag_path_structural_identity_hash_check",
			sql`${table.structuralIdentityHash} ~ '^[0-9a-f]{64}$'`,
		),
	],
);

/** Searchable Path-member projection. It contains structure only, never assertion/display flags. */
export const tagPathMember = pgTable(
	"tag_path_member",
	{
		pathId: uuid()
			.notNull()
			.references(() => tagPath.id, { onDelete: "cascade" }),
		ordinal: integer().notNull(),
		nodeId: uuid()
			.notNull()
			.references(() => vocabularyNode.id, { onDelete: "restrict" }),
		incomingRelationId: uuid().references(() => tagRelation.id, { onDelete: "restrict" }),
	},
	(table) => [
		primaryKey({ columns: [table.pathId, table.ordinal] }),
		unique("tag_path_member_path_node_key").on(table.pathId, table.nodeId),
		index("tag_path_member_node_path_idx").on(table.nodeId, table.pathId, table.ordinal),
		index("tag_path_member_relation_idx").on(table.incomingRelationId, table.pathId, table.ordinal),
		check("tag_path_member_ordinal_check", sql`${table.ordinal} >= 0`),
		check(
			"tag_path_member_incoming_relation_check",
			sql`(${table.ordinal} = 0 and ${table.incomingRelationId} is null)
				or (${table.ordinal} > 0 and ${table.incomingRelationId} is not null)`,
		),
	],
);

/** Global judgment of whether an immutable structural route is valid. */
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

/** Immutable interpretation of a structural Path as one Tag Expression. */
export const tagPathSense = pgTable(
	"tag_path_sense",
	{
		id: createUuidv7PrimaryKey(),
		pathId: uuid()
			.notNull()
			.references(() => tagPath.id, { onDelete: "restrict" }),
		expressionId: uuid()
			.notNull()
			.references(() => tagExpression.id, { onDelete: "restrict" }),
		scope: text().$type<TagPathSenseScope>().default("global").notNull(),
		realmId: uuid().references(() => realm.id, { onDelete: "restrict" }),
		bindingSignature: text().notNull(),
		status: text().$type<TagPathLifecycleStatus>().default("active").notNull(),
		provenance: createJsonObjectColumn<TagPathSenseProvenance>(),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		sealedAt: createTimestampMsColumn(),
		retiredAt: createTimestampMsColumn(),
	},
	(table) => [
		unique("tag_path_sense_id_path_key").on(table.id, table.pathId),
		uniqueIndex("tag_path_sense_global_identity_key")
			.on(table.pathId, table.expressionId, table.bindingSignature)
			.where(sql`${table.scope} = 'global'`),
		uniqueIndex("tag_path_sense_realm_identity_key")
			.on(table.realmId, table.pathId, table.expressionId, table.bindingSignature)
			.where(sql`${table.scope} = 'realm'`),
		index("tag_path_sense_path_route_idx").on(table.pathId, table.status, table.id),
		index("tag_path_sense_expression_route_idx").on(table.expressionId, table.status, table.id),
		index("tag_path_sense_realm_route_idx").on(table.realmId, table.status, table.pathId, table.id),
		check("tag_path_sense_scope_check", inArray(table.scope, TagPathSenseScopeValues)),
		check("tag_path_sense_status_check", inArray(table.status, TagPathLifecycleStatusValues)),
		check(
			"tag_path_sense_authority_check",
			sql`(${table.scope} = 'global' and ${table.realmId} is null)
				or (${table.scope} = 'realm' and ${table.realmId} is not null)`,
		),
		check(
			"tag_path_sense_binding_signature_check",
			sql`btrim(${table.bindingSignature}) <> '' and octet_length(${table.bindingSignature}) <= 2048`,
		),
		check(
			"tag_path_sense_retirement_check",
			sql`(${table.status} = 'active' and ${table.retiredAt} is null)
				or (${table.status} = 'retired' and ${table.retiredAt} is not null)`,
		),
		createJsonObjectConstraint("tag_path_sense_provenance_object_check", table.provenance),
	],
);

/** Binding from one Path member to one typed Expression argument. */
export const tagPathSenseBinding = pgTable(
	"tag_path_sense_binding",
	{
		senseId: uuid()
			.notNull()
			.references(() => tagPathSense.id, { onDelete: "cascade" }),
		memberOrdinal: integer().notNull(),
		argumentRole: text().$type<TagExpressionArgumentRole>().notNull(),
		argumentOrdinal: integer().default(0).notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.senseId, table.memberOrdinal, table.argumentRole, table.argumentOrdinal],
		}),
		unique("tag_path_sense_binding_argument_key").on(
			table.senseId,
			table.argumentRole,
			table.argumentOrdinal,
		),
		index("tag_path_sense_binding_member_idx").on(
			table.memberOrdinal,
			table.senseId,
			table.argumentRole,
		),
		check(
			"tag_path_sense_binding_role_check",
			inArray(table.argumentRole, TagExpressionArgumentRoleValues),
		),
		check("tag_path_sense_binding_member_ordinal_check", sql`${table.memberOrdinal} >= 0`),
		check("tag_path_sense_binding_argument_ordinal_check", sql`${table.argumentOrdinal} >= 0`),
	],
);

/** Global source fact: a Unit adopts one immutable Path Sense. */
export const unitTagPathApplication = pgTable(
	"unit_tag_path_application",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		senseId: uuid()
			.notNull()
			.references(() => tagPathSense.id, { onDelete: "restrict" }),
		createdByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		pinned: boolean().default(false).notNull(),
		position: fractionalIndexPosition(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("unit_tag_path_application_unit_sense_key").on(table.unitId, table.senseId),
		index("unit_tag_path_application_sense_idx").on(table.senseId, table.unitId, table.id),
		index("unit_tag_path_application_unit_position_idx").on(
			table.unitId,
			table.pinned,
			table.position,
			table.id,
		),
		check(
			"unit_tag_path_application_pinned_position_check",
			sql`(${table.pinned} and ${table.position} is not null)
				or (not ${table.pinned} and ${table.position} is null)`,
		),
		createFractionalIndexPositionByteLengthConstraint(
			"unit_tag_path_application_position_byte_length_check",
			table.position,
		),
	],
);

/** Sparse fit/spoiler judgment on one global semantic Application. */
export const unitTagPathApplicationJudgment = pgTable(
	"unit_tag_path_application_judgment",
	{
		applicationId: uuid()
			.notNull()
			.references(() => unitTagPathApplication.id, { onDelete: "cascade" }),
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
		primaryKey({ columns: [table.applicationId, table.profileId] }),
		index("unit_tag_path_application_judgment_profile_idx").on(
			table.profileId,
			table.applicationId,
		),
		index("unit_tag_path_application_judgment_positive_idx")
			.on(table.applicationId, table.profileId)
			.where(sql`${table.fitVote} = 1`),
		check(
			"unit_tag_path_application_judgment_fit_vote_check",
			sql`${table.fitVote} is null or ${table.fitVote} in (-1, 1)`,
		),
		check(
			"unit_tag_path_application_judgment_spoiler_level_check",
			sql`${table.spoilerLevel} is null or ${table.spoilerLevel} between 0 and 2`,
		),
		check(
			"unit_tag_path_application_judgment_sparse_check",
			sql`${table.fitVote} is not null or ${table.spoilerLevel} is not null`,
		),
		check(
			"unit_tag_path_application_judgment_fit_timestamp_check",
			sql`(${table.fitVote} is null) = (${table.fitUpdatedAt} is null)`,
		),
		check(
			"unit_tag_path_application_judgment_spoiler_timestamp_check",
			sql`(${table.spoilerLevel} is null) = (${table.spoilerUpdatedAt} is null)`,
		),
	],
);

/** Audited manual governance convergence between immutable structural Paths. */
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
			sql`${table.proposalSourceKind} = 'human' and ${table.proposalProvenance} is null
			or (
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

/** One Realm's adoption of a global structural Path. */
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

/** Realm-local judgment of a structural Path; never merged with global votes. */
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

/** Explicit Realm adoption of either a global Sense or the Realm's own immutable Sense. */
export const realmTagPathSense = pgTable(
	"realm_tag_path_sense",
	{
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		senseId: uuid().notNull(),
		pathId: uuid().notNull(),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.senseId] }),
		foreignKey({
			columns: [table.senseId, table.pathId],
			foreignColumns: [tagPathSense.id, tagPathSense.pathId],
			name: "realm_tag_path_sense_definition_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.realmId, table.pathId],
			foreignColumns: [realmTagPath.realmId, realmTagPath.pathId],
			name: "realm_tag_path_sense_path_adoption_fkey",
		}).onDelete("cascade"),
		index("realm_tag_path_sense_path_idx").on(table.pathId, table.realmId, table.senseId),
		index("realm_tag_path_sense_sense_idx").on(table.senseId, table.realmId),
	],
);

/** Realm source fact. Authority remains part of the key and source identity. */
export const realmUnitTagPathApplication = pgTable(
	"realm_unit_tag_path_application",
	{
		id: createUuidv7PrimaryKey(),
		realmId: uuid().notNull(),
		unitId: uuid().notNull(),
		senseId: uuid().notNull(),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("realm_unit_tag_path_application_authority_key").on(
			table.realmId,
			table.unitId,
			table.senseId,
		),
		foreignKey({
			columns: [table.realmId, table.unitId],
			foreignColumns: [realmUnit.realmId, realmUnit.unitId],
			name: "realm_unit_tag_path_application_realm_unit_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.realmId, table.senseId],
			foreignColumns: [realmTagPathSense.realmId, realmTagPathSense.senseId],
			name: "realm_unit_tag_path_application_sense_adoption_fkey",
		}).onDelete("restrict"),
		index("realm_unit_tag_path_application_sense_idx").on(
			table.realmId,
			table.senseId,
			table.unitId,
			table.id,
		),
		index("realm_unit_tag_path_application_unit_route_idx").on(
			table.unitId,
			table.realmId,
			table.senseId,
			table.id,
		),
	],
);

/** Sparse fit/spoiler judgment on one Realm semantic Application. */
export const realmUnitTagPathApplicationJudgment = pgTable(
	"realm_unit_tag_path_application_judgment",
	{
		applicationId: uuid()
			.notNull()
			.references(() => realmUnitTagPathApplication.id, { onDelete: "cascade" }),
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
		primaryKey({ columns: [table.applicationId, table.profileId] }),
		index("realm_unit_tag_path_application_judgment_profile_idx").on(
			table.profileId,
			table.applicationId,
		),
		index("realm_unit_tag_path_application_judgment_positive_idx")
			.on(table.applicationId, table.profileId)
			.where(sql`${table.fitVote} = 1`),
		check(
			"realm_unit_tag_path_application_judgment_fit_vote_check",
			sql`${table.fitVote} is null or ${table.fitVote} in (-1, 1)`,
		),
		check(
			"realm_unit_tag_path_application_judgment_spoiler_level_check",
			sql`${table.spoilerLevel} is null or ${table.spoilerLevel} between 0 and 2`,
		),
		check(
			"realm_unit_tag_path_application_judgment_sparse_check",
			sql`${table.fitVote} is not null or ${table.spoilerLevel} is not null`,
		),
		check(
			"realm_unit_tag_path_application_judgment_fit_timestamp_check",
			sql`(${table.fitVote} is null) = (${table.fitUpdatedAt} is null)`,
		),
		check(
			"realm_unit_tag_path_application_judgment_spoiler_timestamp_check",
			sql`(${table.spoilerLevel} is null) = (${table.spoilerUpdatedAt} is null)`,
		),
	],
);
