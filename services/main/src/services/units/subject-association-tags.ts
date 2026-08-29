import type { ContentLanguage } from "@rezics/i18n";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { z } from "zod";

import { database } from "../database";
import {
	ContentLanguageValues,
	SubjectAssociationExpressionPreviewLimit,
} from "../database/schema/contract-values";
import { resolvedUnitLocalizationLanguage, resolvedUnitLocalizationTitle } from "./localization";

export { SubjectAssociationExpressionPreviewLimit };

const PreviewRowSchema = z.object({
	entityId: z.string().uuid(),
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

type PreviewRow = z.infer<typeof PreviewRowSchema>;
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

function compareCodePoints(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Reads a bounded number of accepted global Expression assertions per Entity.
 * Definition hydration stays in the same statement and is bounded by four
 * Expressions times the schema maximum of 32 presentation components.
 */
export function subjectAssociationExpressionPreviewStatement(input: {
	readonly entityIds: readonly string[];
	readonly localizationLanguages: readonly ContentLanguage[];
}) {
	const entityIds = [...new Set(input.entityIds)].sort(compareCodePoints);
	if (!entityIds.length)
		throw new RangeError("Entity Expression preview requires at least one Entity");
	const requestedValues = sql.join(
		entityIds.map((entityId) => sql`(${entityId}::uuid)`),
		sql`, `,
	);
	return sql<PreviewRow>`
		with requested_entity(entity_id) as (values ${requestedValues})
		select
			requested_entity.entity_id as "entityId",
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
			select
				assertion.expression_id,
				expression.expression_kind,
				expression.focus_tag_id,
				row_number() over (
					order by assertion.direct desc, assertion.path_application_count desc, assertion.expression_id
				) as preview_rank
			from public.unit_expression_assertion assertion
			join public.tag_expression expression on expression.id = assertion.expression_id
			where assertion.unit_id = requested_entity.entity_id
				and expression.status = 'active'
				and expression.sealed_at is not null
			order by preview_rank
			limit ${SubjectAssociationExpressionPreviewLimit}
		) ranked
		join public.tag_expression_presentation_revision presentation
			on presentation.expression_id = ranked.expression_id
			and presentation.status = 'active'
			and presentation.sealed_at is not null
		join public.tag_expression_label_component component
			on component.presentation_revision_id = presentation.id
		left join public.tag_expression_group_key group_key
			on group_key.presentation_revision_id = presentation.id
		order by requested_entity.entity_id, ranked.preview_rank, component.ordinal
	`;
}

export async function getSubjectAssociationExpressionPreviews(
	entityIds: readonly string[],
	localizationLanguages: readonly ContentLanguage[] = [],
): Promise<ReadonlyMap<string, readonly SubjectAssociationExpressionPreview[]>> {
	if (!entityIds.length) return new Map();
	const result = await database.execute(
		subjectAssociationExpressionPreviewStatement({ entityIds, localizationLanguages }),
	);
	const previews = new Map<string, SubjectAssociationExpressionPreview[]>();
	const expressionByKey = new Map<string, SubjectAssociationExpressionPreview>();
	for (const value of result.rows) {
		const row = PreviewRowSchema.parse(value);
		const key = `${row.entityId}:${row.expressionId}`;
		let expression = expressionByKey.get(key);
		if (!expression) {
			const entityExpressions = previews.get(row.entityId) ?? [];
			if (entityExpressions.length >= SubjectAssociationExpressionPreviewLimit)
				throw new Error("Entity Expression preview query exceeded its per-Entity bound");
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
			previews.set(row.entityId, entityExpressions);
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
	return previews;
}

/** SQL renderer used only by deterministic query-shape tests. @internal */
export function renderSubjectAssociationExpressionPreviewStatement(
	input: Parameters<typeof subjectAssociationExpressionPreviewStatement>[0],
) {
	return new PgDialect().sqlToQuery(subjectAssociationExpressionPreviewStatement(input));
}
