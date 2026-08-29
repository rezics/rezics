import type { ContentLanguage } from "@rezics/i18n";
import { sql, type SQL } from "drizzle-orm";

import { database } from "../database";
import type { TagExpressionEffectiveEvidenceKind } from "../database/schema";
import {
	readTagExpressionDefinitions,
	type TagExpressionDefinition,
} from "../tag-expressions/service";
import type { SearchExpression } from "./query";

export const SearchTagMatchReasonLimit = 8;

export type SearchTagMatchEvidence = "direct" | TagExpressionEffectiveEvidenceKind;

export interface SearchTagMatchReason {
	readonly matchedTagId: string;
	readonly evidence: SearchTagMatchEvidence;
	readonly expression: TagExpressionDefinition;
}

function uuidArray(values: readonly string[]): SQL {
	return sql`ARRAY[${sql.join(
		values.map((value) => sql`${value}::uuid`),
		sql`, `,
	)}]::uuid[]`;
}

function positiveTagFilterValues(expression: SearchExpression): readonly string[] {
	if (!("field" in expression)) {
		if (expression.operator === "not") return [];
		return expression.clauses.flatMap(positiveTagFilterValues);
	}
	if (expression.field === "realm-tag-vote") return [expression.tagId];
	if (expression.field !== "tag") return [];
	if (expression.operator === "equals")
		return typeof expression.value === "string" ? [expression.value] : [];
	if (expression.operator === "any-of" || expression.operator === "all-of")
		return expression.values.filter((value): value is string => typeof value === "string");
	return [];
}

/**
 * Reads only positively requested Tag concepts. Negative clauses cannot explain
 * why a result matched and therefore never become user-visible evidence.
 */
export function readPositiveSearchTagIds(
	expression: SearchExpression | undefined,
): readonly string[] {
	return expression ? [...new Set(positiveTagFilterValues(expression))] : [];
}

/**
 * Resolves bounded, semantic Search evidence for one page of Unit identities.
 * The corpus-side join remains proportional to the page and selected Tags;
 * inference expansion is read from the definition-scale closure.
 */
export async function getSearchTagMatchReasons(input: {
	readonly unitIds: readonly string[];
	readonly tagIds: readonly string[];
	readonly localizationLanguages: readonly ContentLanguage[];
}): Promise<Map<string, SearchTagMatchReason[]>> {
	const unitIds = [...new Set(input.unitIds)];
	const tagIds = [...new Set(input.tagIds)];
	if (!unitIds.length || !tagIds.length) return new Map();

	type EvidenceRow = {
		readonly unitId: string;
		readonly expressionId: string;
		readonly matchedTagId: string;
		readonly evidence: SearchTagMatchEvidence;
	};
	const result = await database.execute<EvidenceRow>(sql`
		with candidate_evidence as (
			select
				assertion.unit_id,
				assertion.expression_id,
				effective.tag_id,
				case
					when effective.evidence_kind = 'primary' and assertion.direct then 'direct'
					else effective.evidence_kind
				end as evidence,
				case
					when effective.evidence_kind = 'primary' and assertion.direct then 0
					when effective.evidence_kind = 'primary' then 1
					when effective.evidence_kind = 'entailed' then 2
					else 3
				end as evidence_rank
			from public.unit_expression_assertion assertion
			join public.tag_expression_effective_tag effective
				on effective.expression_id = assertion.expression_id
			where assertion.unit_id = any(${uuidArray(unitIds)})
				and effective.tag_id = any(${uuidArray(tagIds)})
		), chosen_expression as (
			select distinct on (unit_id, expression_id)
				unit_id,
				expression_id,
				tag_id,
				evidence,
				evidence_rank
			from candidate_evidence
			order by unit_id, expression_id, evidence_rank, tag_id
		), ranked as (
			select
				unit_id,
				expression_id,
				tag_id,
				evidence,
				row_number() over (
					partition by unit_id
					order by evidence_rank, expression_id, tag_id
				) as ordinal
			from chosen_expression
		)
		select
			unit_id as "unitId",
			expression_id as "expressionId",
			tag_id as "matchedTagId",
			evidence
		from ranked
		where ordinal <= ${SearchTagMatchReasonLimit}
		order by unit_id, ordinal
	`);
	const definitions = await readTagExpressionDefinitions(
		result.rows.map((row) => row.expressionId),
		input.localizationLanguages,
	);
	const byUnit = new Map<string, SearchTagMatchReason[]>();
	for (const row of result.rows) {
		const expression = definitions.get(row.expressionId);
		if (!expression) continue;
		const values = byUnit.get(row.unitId) ?? [];
		values.push({
			matchedTagId: row.matchedTagId,
			evidence: row.evidence,
			expression,
		});
		byUnit.set(row.unitId, values);
	}
	return byUnit;
}

/** Counts additional public hierarchy positions for bounded Tag Search hits. */
export async function getTagOtherPositionCounts(
	tagIds: readonly string[],
): Promise<ReadonlyMap<string, number>> {
	const ids = [...new Set(tagIds)];
	if (!ids.length) return new Map();
	const result = await database.execute<{
		readonly tagId: string;
		readonly otherPositionCount: number;
	}>(sql`
		select
			position_member.node_id as "tagId",
			greatest(count(*)::integer - 1, 0) as "otherPositionCount"
		from public.tag_path_member position_member
		join public.unit position_unit on position_unit.id = position_member.path_id
		join public.tag_path_vote_stat position_stat
			on position_stat.path_id = position_member.path_id
			and position_stat.score > 0
			and position_stat.vote_count > 0
		where position_member.node_id = any(${uuidArray(ids)})
			and position_unit.status = 'published'
			and position_unit.visibility = 'public'
			and position_unit.deleted_at is null
		group by position_member.node_id
	`);
	return new Map(result.rows.map((row) => [row.tagId, row.otherPositionCount] as const));
}
