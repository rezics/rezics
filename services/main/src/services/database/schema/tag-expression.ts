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
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile } from "./profile";
import { realmUnit } from "./realm";
import { tag } from "./tag";
import { unit } from "./unit";

export const TagExpressionKindValues = ["simple", "facet_value", "relation"] as const;
export type TagExpressionKind = (typeof TagExpressionKindValues)[number];

export const TagExpressionStatusValues = ["active", "retired"] as const;
export type TagExpressionStatus = (typeof TagExpressionStatusValues)[number];

export const TagExpressionArgumentRoleValues = [
	"predicate",
	"slot",
	"value",
	"focus",
	"qualifier",
] as const;
export type TagExpressionArgumentRole = (typeof TagExpressionArgumentRoleValues)[number];

export const TagExpressionLabelComponentKindValues = ["required", "fallback"] as const;
export type TagExpressionLabelComponentKind =
	(typeof TagExpressionLabelComponentKindValues)[number];

export const TagExpressionInferenceKindValues = ["entailed", "retrieval_only"] as const;
export type TagExpressionInferenceKind = (typeof TagExpressionInferenceKindValues)[number];

/** Hard definition-write bounds mirrored by the canonical PostgreSQL guards. */
export const TagExpressionMaximumActiveInferenceRules = 16 as const;
export const TagExpressionMaximumReachableExpressions = 64 as const;
export const TagExpressionMaximumEffectiveTags = 256 as const;

export const TagExpressionEffectiveEvidenceKindValues = [
	"primary",
	"entailed",
	"retrieval_only",
] as const;
export type TagExpressionEffectiveEvidenceKind =
	(typeof TagExpressionEffectiveEvidenceKindValues)[number];

export type TagExpressionInferenceProvenance = Readonly<Record<string, unknown>>;

/** Immutable structured proposition that can be asserted about a Unit. */
export const tagExpression = pgTable(
	"tag_expression",
	{
		id: createUuidv7PrimaryKey(),
		expressionKind: text().$type<TagExpressionKind>().notNull(),
		canonicalClaimKey: text().notNull(),
		/** Primary concept indexed for the Expression before explicit inference is applied. */
		focusTagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
		status: text().$type<TagExpressionStatus>().default("active").notNull(),
		createdByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		createdAt: createCreatedAtColumn(),
		sealedAt: createTimestampMsColumn(),
		retiredAt: createTimestampMsColumn(),
	},
	(table) => [
		unique("tag_expression_claim_key").on(table.canonicalClaimKey),
		uniqueIndex("tag_expression_simple_focus_key")
			.on(table.focusTagId)
			.where(sql`${table.expressionKind} = 'simple'`),
		index("tag_expression_focus_status_idx").on(
			table.focusTagId,
			table.status,
			table.expressionKind,
			table.id,
		),
		check("tag_expression_kind_check", inArray(table.expressionKind, TagExpressionKindValues)),
		check("tag_expression_status_check", inArray(table.status, TagExpressionStatusValues)),
		check(
			"tag_expression_claim_key_check",
			sql`btrim(${table.canonicalClaimKey}) <> '' and octet_length(${table.canonicalClaimKey}) <= 2048`,
		),
		check(
			"tag_expression_retirement_check",
			sql`(${table.status} = 'active' and ${table.retiredAt} is null)
				or (${table.status} = 'retired' and ${table.retiredAt} is not null)`,
		),
	],
);

/** Typed concept argument in one Expression; roles are deliberately not mutually exclusive by Tag. */
export const tagExpressionArgument = pgTable(
	"tag_expression_argument",
	{
		expressionId: uuid()
			.notNull()
			.references(() => tagExpression.id, { onDelete: "cascade" }),
		role: text().$type<TagExpressionArgumentRole>().notNull(),
		ordinal: integer().default(0).notNull(),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
	},
	(table) => [
		primaryKey({ columns: [table.expressionId, table.role, table.ordinal] }),
		unique("tag_expression_argument_role_tag_key").on(table.expressionId, table.role, table.tagId),
		index("tag_expression_argument_tag_idx").on(table.tagId, table.expressionId, table.role),
		check(
			"tag_expression_argument_role_check",
			inArray(table.role, TagExpressionArgumentRoleValues),
		),
		check("tag_expression_argument_ordinal_check", sql`${table.ordinal} >= 0`),
	],
);

/** Replaceable presentation definition for an immutable Expression. */
export const tagExpressionPresentationRevision = pgTable(
	"tag_expression_presentation_revision",
	{
		id: createUuidv7PrimaryKey(),
		expressionId: uuid()
			.notNull()
			.references(() => tagExpression.id, { onDelete: "cascade" }),
		revision: integer().default(1).notNull(),
		status: text().$type<TagExpressionStatus>().default("active").notNull(),
		createdByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		createdAt: createCreatedAtColumn(),
		sealedAt: createTimestampMsColumn(),
		retiredAt: createTimestampMsColumn(),
	},
	(table) => [
		unique("tag_expression_presentation_revision_key").on(table.expressionId, table.revision),
		uniqueIndex("tag_expression_presentation_active_key")
			.on(table.expressionId)
			.where(sql`${table.status} = 'active'`),
		index("tag_expression_presentation_expression_idx").on(
			table.expressionId,
			table.status,
			table.revision,
		),
		check("tag_expression_presentation_revision_check", sql`${table.revision} >= 1`),
		check(
			"tag_expression_presentation_status_check",
			inArray(table.status, TagExpressionStatusValues),
		),
		check(
			"tag_expression_presentation_retirement_check",
			sql`(${table.status} = 'active' and ${table.retiredAt} is null)
				or (${table.status} = 'retired' and ${table.retiredAt} is not null)`,
		),
	],
);

/** Ordered standalone signature plus collision-repair components for one presentation revision. */
export const tagExpressionLabelComponent = pgTable(
	"tag_expression_label_component",
	{
		presentationRevisionId: uuid()
			.notNull()
			.references(() => tagExpressionPresentationRevision.id, { onDelete: "cascade" }),
		ordinal: integer().notNull(),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
		semanticRole: text().$type<TagExpressionArgumentRole>().notNull(),
		componentKind: text().$type<TagExpressionLabelComponentKind>().default("required").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.presentationRevisionId, table.ordinal] }),
		unique("tag_expression_label_component_semantic_key").on(
			table.presentationRevisionId,
			table.tagId,
			table.semanticRole,
			table.componentKind,
		),
		index("tag_expression_label_component_tag_idx").on(table.tagId, table.presentationRevisionId),
		check("tag_expression_label_component_ordinal_check", sql`${table.ordinal} >= 0`),
		check(
			"tag_expression_label_component_role_check",
			inArray(table.semanticRole, TagExpressionArgumentRoleValues),
		),
		check(
			"tag_expression_label_component_kind_check",
			inArray(table.componentKind, TagExpressionLabelComponentKindValues),
		),
	],
);

/** Semantic component a renderer may express once as a group heading. */
export const tagExpressionGroupKey = pgTable(
	"tag_expression_group_key",
	{
		presentationRevisionId: uuid()
			.primaryKey()
			.references(() => tagExpressionPresentationRevision.id, { onDelete: "cascade" }),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
		semanticRole: text().$type<TagExpressionArgumentRole>().notNull(),
	},
	(table) => [
		index("tag_expression_group_key_tag_idx").on(table.tagId, table.presentationRevisionId),
		check(
			"tag_expression_group_key_role_check",
			inArray(table.semanticRole, TagExpressionArgumentRoleValues),
		),
	],
);

/** Immutable governed inference-rule revision. Exactly one target kind is populated. */
export const tagExpressionInferenceRule = pgTable(
	"tag_expression_inference_rule",
	{
		id: createUuidv7PrimaryKey(),
		sourceExpressionId: uuid()
			.notNull()
			.references(() => tagExpression.id, { onDelete: "cascade" }),
		targetTagId: uuid().references(() => tag.id, { onDelete: "restrict" }),
		targetExpressionId: uuid().references(() => tagExpression.id, { onDelete: "restrict" }),
		inferenceKind: text().$type<TagExpressionInferenceKind>().notNull(),
		revision: integer().default(1).notNull(),
		status: text().$type<TagExpressionStatus>().default("active").notNull(),
		provenance: createJsonObjectColumn<TagExpressionInferenceProvenance>(),
		createdByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		createdAt: createCreatedAtColumn(),
		retiredAt: createTimestampMsColumn(),
	},
	(table) => [
		uniqueIndex("tag_expression_inference_rule_tag_revision_key")
			.on(table.sourceExpressionId, table.targetTagId, table.inferenceKind, table.revision)
			.where(sql`${table.targetTagId} is not null`),
		uniqueIndex("tag_expression_inference_rule_expression_revision_key")
			.on(table.sourceExpressionId, table.targetExpressionId, table.inferenceKind, table.revision)
			.where(sql`${table.targetExpressionId} is not null`),
		uniqueIndex("tag_expression_inference_rule_active_tag_key")
			.on(table.sourceExpressionId, table.targetTagId, table.inferenceKind)
			.where(sql`${table.status} = 'active' and ${table.targetTagId} is not null`),
		uniqueIndex("tag_expression_inference_rule_active_expression_key")
			.on(table.sourceExpressionId, table.targetExpressionId, table.inferenceKind)
			.where(sql`${table.status} = 'active' and ${table.targetExpressionId} is not null`),
		index("tag_expression_inference_rule_source_idx").on(
			table.sourceExpressionId,
			table.status,
			table.inferenceKind,
			table.id,
		),
		index("tag_expression_inference_rule_target_tag_idx").on(
			table.targetTagId,
			table.status,
			table.id,
		),
		index("tag_expression_inference_rule_target_expression_idx").on(
			table.targetExpressionId,
			table.status,
			table.id,
		),
		check(
			"tag_expression_inference_rule_kind_check",
			inArray(table.inferenceKind, TagExpressionInferenceKindValues),
		),
		check("tag_expression_inference_rule_revision_check", sql`${table.revision} >= 1`),
		check(
			"tag_expression_inference_rule_status_check",
			inArray(table.status, TagExpressionStatusValues),
		),
		check(
			"tag_expression_inference_rule_target_check",
			sql`num_nonnulls(${table.targetTagId}, ${table.targetExpressionId}) = 1`,
		),
		check(
			"tag_expression_inference_rule_not_self_check",
			sql`${table.targetExpressionId} is null or ${table.sourceExpressionId} <> ${table.targetExpressionId}`,
		),
		check(
			"tag_expression_inference_rule_retirement_check",
			sql`(${table.status} = 'active' and ${table.retiredAt} is null)
				or (${table.status} = 'retired' and ${table.retiredAt} is not null)`,
		),
		createJsonObjectConstraint(
			"tag_expression_inference_rule_provenance_object_check",
			table.provenance,
		),
	],
);

/** Definition-scale closure used to keep corpus work proportional to explicit outputs. */
export const tagExpressionEffectiveTag = pgTable(
	"tag_expression_effective_tag",
	{
		expressionId: uuid()
			.notNull()
			.references(() => tagExpression.id, { onDelete: "cascade" }),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
		evidenceKind: text().$type<TagExpressionEffectiveEvidenceKind>().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.expressionId, table.tagId, table.evidenceKind] }),
		index("tag_expression_effective_tag_tag_idx").on(
			table.tagId,
			table.evidenceKind,
			table.expressionId,
		),
		check(
			"tag_expression_effective_tag_kind_check",
			inArray(table.evidenceKind, TagExpressionEffectiveEvidenceKindValues),
		),
	],
);

/** Rebuildable global aggregation of direct and accepted Path-Sense sources. */
export const unitExpressionAssertion = pgTable(
	"unit_expression_assertion",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		expressionId: uuid()
			.notNull()
			.references(() => tagExpression.id, { onDelete: "cascade" }),
		direct: boolean().default(false).notNull(),
		pathApplicationCount: bigint({ mode: "bigint" }).default(0n).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.expressionId] }),
		index("unit_expression_assertion_expression_idx").on(table.expressionId, table.unitId),
		check(
			"unit_expression_assertion_source_check",
			sql`${table.direct} or ${table.pathApplicationCount} > 0`,
		),
		check("unit_expression_assertion_path_count_check", sql`${table.pathApplicationCount} >= 0`),
	],
);

/** Rebuildable global retrieval projection; never used as a rendered badge identity. */
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
		primaryExpressionCount: bigint({ mode: "bigint" }).default(0n).notNull(),
		entailedExpressionCount: bigint({ mode: "bigint" }).default(0n).notNull(),
		retrievalExpressionCount: bigint({ mode: "bigint" }).default(0n).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.tagId] }),
		index("unit_effective_tag_tag_idx").on(table.tagId, table.unitId),
		check(
			"unit_effective_tag_source_check",
			sql`${table.direct}
				or ${table.primaryExpressionCount} > 0
				or ${table.entailedExpressionCount} > 0
				or ${table.retrievalExpressionCount} > 0`,
		),
		check("unit_effective_tag_not_self_check", sql`${table.unitId} <> ${table.tagId}`),
		check(
			"unit_effective_tag_count_check",
			sql`${table.primaryExpressionCount} >= 0
				and ${table.entailedExpressionCount} >= 0
				and ${table.retrievalExpressionCount} >= 0`,
		),
	],
);

/** Rebuildable Realm aggregation; authority is part of every key. */
export const realmUnitExpressionAssertion = pgTable(
	"realm_unit_expression_assertion",
	{
		realmId: uuid().notNull(),
		unitId: uuid().notNull(),
		expressionId: uuid()
			.notNull()
			.references(() => tagExpression.id, { onDelete: "cascade" }),
		direct: boolean().default(false).notNull(),
		pathApplicationCount: bigint({ mode: "bigint" }).default(0n).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.unitId, table.expressionId] }),
		foreignKey({
			columns: [table.realmId, table.unitId],
			foreignColumns: [realmUnit.realmId, realmUnit.unitId],
			name: "realm_unit_expression_assertion_realm_unit_fkey",
		}).onDelete("cascade"),
		index("realm_unit_expression_assertion_expression_idx").on(
			table.expressionId,
			table.realmId,
			table.unitId,
		),
		index("realm_unit_expression_assertion_unit_route_idx").on(
			table.unitId,
			table.realmId,
			table.expressionId,
		),
		check(
			"realm_unit_expression_assertion_source_check",
			sql`${table.direct} or ${table.pathApplicationCount} > 0`,
		),
		check(
			"realm_unit_expression_assertion_path_count_check",
			sql`${table.pathApplicationCount} >= 0`,
		),
	],
);

/** Rebuildable Realm retrieval projection; never merged with global evidence. */
export const realmUnitEffectiveTag = pgTable(
	"realm_unit_effective_tag",
	{
		realmId: uuid().notNull(),
		unitId: uuid().notNull(),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
		direct: boolean().default(false).notNull(),
		primaryExpressionCount: bigint({ mode: "bigint" }).default(0n).notNull(),
		entailedExpressionCount: bigint({ mode: "bigint" }).default(0n).notNull(),
		retrievalExpressionCount: bigint({ mode: "bigint" }).default(0n).notNull(),
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
		index("realm_unit_effective_tag_unit_route_idx").on(table.unitId, table.realmId, table.tagId),
		check(
			"realm_unit_effective_tag_source_check",
			sql`${table.direct}
				or ${table.primaryExpressionCount} > 0
				or ${table.entailedExpressionCount} > 0
				or ${table.retrievalExpressionCount} > 0`,
		),
		check(
			"realm_unit_effective_tag_count_check",
			sql`${table.primaryExpressionCount} >= 0
				and ${table.entailedExpressionCount} >= 0
				and ${table.retrievalExpressionCount} >= 0`,
		),
	],
);

/** Durable definition-change work; one transaction advances one bounded authority page. */
export const tagExpressionProjectionRebuild = pgTable(
	"tag_expression_projection_rebuild",
	{
		expressionId: uuid()
			.primaryKey()
			.references(() => tagExpression.id, { onDelete: "cascade" }),
		globalCursorUnitId: uuid(),
		globalComplete: boolean().default(false).notNull(),
		realmCursorRealmId: uuid(),
		realmCursorUnitId: uuid(),
		realmComplete: boolean().default(false).notNull(),
		attemptCount: integer().default(0).notNull(),
		availableAt: createTimestampMsColumn().defaultNow().notNull(),
		lastErrorMessage: text(),
		requestedAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("tag_expression_projection_rebuild_claim_idx").on(
			table.availableAt,
			table.requestedAt,
			table.expressionId,
		),
		check(
			"tag_expression_projection_rebuild_realm_cursor_check",
			sql`(${table.realmCursorRealmId} is null) = (${table.realmCursorUnitId} is null)`,
		),
		check("tag_expression_projection_rebuild_attempt_check", sql`${table.attemptCount} >= 0`),
		check(
			"tag_expression_projection_rebuild_incomplete_check",
			sql`not (${table.globalComplete} and ${table.realmComplete})`,
		),
	],
);
