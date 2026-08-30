import type { ContentLanguage } from "@rezics/i18n";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { z } from "zod";

import { database } from "../database";
import {
	ContentLanguageValues,
	DefaultContentRatingValues,
	MaximumSubjectAssociationExpressionsPerItem,
	SubjectAssociationExpressionCandidateScanLimit,
	SubjectAssociationExpressionPreviewLimit,
	type ContentRating,
} from "../database/schema/contract-values";
import { resolvedUnitLocalizationLanguage, resolvedUnitLocalizationTitle } from "./localization";

export { SubjectAssociationExpressionPreviewLimit };

const ExpressionRowSchema = z.object({
	entityId: z.string().uuid(),
	scanComplete: z.boolean(),
	expressionId: z.string().uuid(),
	expressionKind: z.enum(["simple", "facet_value", "relation"]),
	focusTagId: z.string().uuid(),
	presentationRevision: z.coerce.number().int().positive(),
	componentOrdinal: z.coerce.number().int().nonnegative(),
	componentTagId: z.string().uuid(),
	semanticRole: z.enum(["predicate", "slot", "value", "focus", "qualifier"]),
	componentKind: z.enum(["required", "fallback"]),
	componentLanguage: z.enum(ContentLanguageValues).nullable(),
	componentTitle: z.string().nullable(),
	groupTagId: z.string().uuid().nullable(),
	groupSemanticRole: z.enum(["predicate", "slot", "value", "focus", "qualifier"]).nullable(),
	groupLanguage: z.enum(ContentLanguageValues).nullable(),
	groupTitle: z.string().nullable(),
});

const PreviewRowSchema = z.union([
	ExpressionRowSchema,
	z.object({
		entityId: z.string().uuid(),
		scanComplete: z.boolean(),
		expressionId: z.null(),
	}),
]);

type PreviewRow = z.infer<typeof ExpressionRowSchema>;
type ExpressionComponent = {
	readonly tagId: string;
	readonly semanticRole: PreviewRow["semanticRole"];
	readonly componentKind: PreviewRow["componentKind"];
	readonly language: ContentLanguage | null;
	readonly title: string | null;
};
export type SubjectAssociationExpressionPreview = {
	readonly expressionId: string;
	readonly expressionKind: PreviewRow["expressionKind"];
	readonly focusTagId: string;
	readonly presentationRevision: number;
	readonly components: ExpressionComponent[];
	readonly groupKey: {
		readonly tagId: string;
		readonly semanticRole: PreviewRow["semanticRole"];
		readonly language: ContentLanguage | null;
		readonly title: string | null;
	} | null;
};

export interface SubjectAssociationExpressionSet {
	readonly expressions: readonly SubjectAssociationExpressionPreview[];
	readonly complete: boolean;
}

export interface SubjectAssociationExpressionReadInput {
	readonly entityIds: readonly string[];
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly allowedContentRatings: readonly ContentRating[];
	readonly includeSpoilers: boolean;
	readonly limit: number;
}

function compareCodePoints(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function effectiveSpoilerLevel(statAlias: string): ReturnType<typeof sql> {
	return sql.raw(`case
		when coalesce(${statAlias}.spoiler_vote_count, 0) > 0
			and ${statAlias}.spoiler_major_count * 2 >= ${statAlias}.spoiler_vote_count then 2
		when coalesce(${statAlias}.spoiler_vote_count, 0) > 0
			and (${statAlias}.spoiler_minor_count + ${statAlias}.spoiler_major_count) * 2
				>= ${statAlias}.spoiler_vote_count then 1
		when coalesce(${statAlias}.spoiler_vote_count, 0) > 0 then 0
		else coalesce(focus_tag.default_spoiler_level, 0)
	end`);
}

/**
 * Reads bounded, source-visible global Expression assertions for Entity cards.
 *
 * The statement uses the accepted assertion projection for candidate identity,
 * then proves that at least one backing source is visible under the viewer's
 * spoiler policy. Focus-Tag content rating is filtered before any localized
 * label is hydrated. A structured Expression replaces its simple focus-only
 * duplicate, which preserves one semantic badge per VNDB Trait.
 */
export function subjectAssociationExpressionStatement(
	input: SubjectAssociationExpressionReadInput,
) {
	const entityIds = [...new Set(input.entityIds)].sort(compareCodePoints);
	if (!entityIds.length)
		throw new RangeError("Entity Expression read requires at least one Entity");
	if (
		!Number.isInteger(input.limit) ||
		input.limit < 1 ||
		input.limit > MaximumSubjectAssociationExpressionsPerItem
	)
		throw new RangeError("Entity Expression read limit is outside its request-path bound");
	if (!input.allowedContentRatings.length)
		throw new RangeError("Entity Expression read requires a non-empty content-rating allowlist");

	const requestedValues = sql.join(
		entityIds.map((entityId) => sql`(${entityId}::uuid)`),
		sql`, `,
	);
	const allowedRatings = sql.join(
		input.allowedContentRatings.map((rating) => sql`${rating}`),
		sql`, `,
	);
	const sourceVisibility = input.includeSpoilers
		? sql`true`
		: sql`(
			(assertion.direct and exists (
				select 1
				from public.unit_tag direct_tag
				left join public.unit_tag_judgment_stat direct_stat
					on direct_stat.unit_id = direct_tag.unit_id
					and direct_stat.tag_id = direct_tag.tag_id
				where direct_tag.unit_id = assertion.unit_id
					and direct_tag.tag_id = expression.focus_tag_id
					and ${effectiveSpoilerLevel("direct_stat")} = 0
			))
			or exists (
				select 1
				from public.unit_tag_path_application application
				join public.tag_path_sense sense on sense.id = application.sense_id
				join public.unit_tag_path_application_judgment_stat path_stat
					on path_stat.application_id = application.id
				where application.unit_id = assertion.unit_id
					and sense.expression_id = assertion.expression_id
					and sense.sealed_at is not null
					and path_stat.score > 0
					and path_stat.vote_count > 0
					and ${effectiveSpoilerLevel("path_stat")} = 0
			)
		)`;

	return sql<PreviewRow>`
		with requested_entity(entity_id) as (values ${requestedValues})
		select
			requested_entity.entity_id as "entityId",
			ranked.scan_complete as "scanComplete",
			ranked.expression_id as "expressionId",
			ranked.expression_kind as "expressionKind",
			ranked.focus_tag_id as "focusTagId",
			presentation.revision as "presentationRevision",
			component.ordinal as "componentOrdinal",
			component.tag_id as "componentTagId",
			component.semantic_role as "semanticRole",
			component.component_kind as "componentKind",
			${resolvedUnitLocalizationLanguage(sql`component.tag_id`, input.localizationLanguages)} as "componentLanguage",
			${resolvedUnitLocalizationTitle(sql`component.tag_id`, input.localizationLanguages)} as "componentTitle",
			group_key.tag_id as "groupTagId",
			group_key.semantic_role as "groupSemanticRole",
			case when group_key.tag_id is null then null else ${resolvedUnitLocalizationLanguage(sql`group_key.tag_id`, input.localizationLanguages)} end as "groupLanguage",
			case when group_key.tag_id is null then null else ${resolvedUnitLocalizationTitle(sql`group_key.tag_id`, input.localizationLanguages)} end as "groupTitle"
		from requested_entity
		cross join lateral (
			with raw_assertion as (
				select
					assertion.unit_id,
					assertion.expression_id,
					assertion.direct
				from public.unit_expression_assertion assertion
				where assertion.unit_id = requested_entity.entity_id
				order by assertion.expression_id
				limit ${SubjectAssociationExpressionCandidateScanLimit + 1}
			), scan_state as (
				select not exists (
					select 1
					from raw_assertion
					order by expression_id
					offset ${SubjectAssociationExpressionCandidateScanLimit}
				) as scan_complete
			), scanned_assertion as (
				select *
				from raw_assertion
				order by expression_id
				limit ${SubjectAssociationExpressionCandidateScanLimit}
			), candidate as (
				select
					assertion.expression_id,
					expression.expression_kind,
					expression.focus_tag_id
				from scanned_assertion assertion
				join public.tag_expression expression on expression.id = assertion.expression_id
				join public.tag focus_tag on focus_tag.id = expression.focus_tag_id
				join public.unit focus_unit on focus_unit.id = expression.focus_tag_id
				where assertion.unit_id = requested_entity.entity_id
					and expression.status = 'active'
					and expression.sealed_at is not null
					and focus_unit.status = 'published'
					and focus_unit.visibility in ('public', 'unlisted')
					and focus_unit.moderation_status = 'approved'
					and focus_unit.deleted_at is null
					and focus_unit.content_rating in (${allowedRatings})
					and ${sourceVisibility}
			), visible as (
				select candidate.*
				from candidate
				where candidate.expression_kind <> 'simple'
					or not exists (
						select 1
						from candidate structured
						where structured.focus_tag_id = candidate.focus_tag_id
							and structured.expression_kind <> 'simple'
					)
			), ranked_visible as (
			select
				visible.*,
				row_number() over (
					order by visible.expression_id
				) as expression_rank
			from visible
			order by expression_rank
			limit ${input.limit + 1}
			)
			select ranked_visible.*, scan_state.scan_complete
			from scan_state
			left join ranked_visible on true
		) ranked
		left join public.tag_expression_presentation_revision presentation
			on presentation.expression_id = ranked.expression_id
			and presentation.status = 'active'
			and presentation.sealed_at is not null
		left join public.tag_expression_label_component component
			on component.presentation_revision_id = presentation.id
		left join public.tag_expression_group_key group_key
			on group_key.presentation_revision_id = presentation.id
		order by requested_entity.entity_id, ranked.expression_rank nulls first, component.ordinal
	`;
}

export async function getSubjectAssociationExpressions(
	input: SubjectAssociationExpressionReadInput,
): Promise<ReadonlyMap<string, SubjectAssociationExpressionSet>> {
	if (!input.entityIds.length) return new Map();
	const result = await database.execute(subjectAssociationExpressionStatement(input));
	const expressionsByEntity = new Map<string, SubjectAssociationExpressionPreview[]>();
	const scanCompleteByEntity = new Map<string, boolean>();
	const expressionByKey = new Map<string, SubjectAssociationExpressionPreview>();
	for (const value of result.rows) {
		const row = PreviewRowSchema.parse(value);
		scanCompleteByEntity.set(row.entityId, row.scanComplete);
		if (row.expressionId === null) continue;
		const key = `${row.entityId}:${row.expressionId}`;
		let expression = expressionByKey.get(key);
		if (!expression) {
			const entityExpressions = expressionsByEntity.get(row.entityId) ?? [];
			if (entityExpressions.length > input.limit)
				throw new Error("Entity Expression query exceeded its per-Entity limit-plus-one bound");
			expression = {
				expressionId: row.expressionId,
				expressionKind: row.expressionKind,
				focusTagId: row.focusTagId,
				presentationRevision: row.presentationRevision,
				components: [],
				groupKey:
					row.groupTagId && row.groupSemanticRole
						? {
								tagId: row.groupTagId,
								semanticRole: row.groupSemanticRole,
								language: row.groupLanguage,
								title: row.groupTitle,
							}
						: null,
			};
			entityExpressions.push(expression);
			expressionsByEntity.set(row.entityId, entityExpressions);
			expressionByKey.set(key, expression);
		}
		expression.components.push({
			tagId: row.componentTagId,
			semanticRole: row.semanticRole,
			componentKind: row.componentKind,
			language: row.componentLanguage,
			title: row.componentTitle,
		});
	}

	return new Map(
		[...new Set(input.entityIds)].map((entityId) => {
			const expressions = expressionsByEntity.get(entityId) ?? [];
			return [
				entityId,
				{
					expressions: expressions.slice(0, input.limit),
					complete:
						(scanCompleteByEntity.get(entityId) ?? true) && expressions.length <= input.limit,
				},
			] as const;
		}),
	);
}

export async function getSubjectAssociationExpressionPreviews(
	entityIds: readonly string[],
	localizationLanguages: readonly ContentLanguage[] = [],
	options: {
		readonly allowedContentRatings?: readonly ContentRating[];
		readonly includeSpoilers?: boolean;
	} = {},
): Promise<ReadonlyMap<string, readonly SubjectAssociationExpressionPreview[]>> {
	const sets = await getSubjectAssociationExpressions({
		entityIds,
		localizationLanguages,
		allowedContentRatings: options.allowedContentRatings ?? DefaultContentRatingValues,
		includeSpoilers: options.includeSpoilers ?? false,
		limit: SubjectAssociationExpressionPreviewLimit,
	});
	return new Map([...sets].map(([entityId, value]) => [entityId, value.expressions]));
}

/** SQL renderer used only by deterministic query-shape tests. @internal */
export function renderSubjectAssociationExpressionStatement(
	input: SubjectAssociationExpressionReadInput,
) {
	return new PgDialect().sqlToQuery(subjectAssociationExpressionStatement(input));
}
