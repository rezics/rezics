import type { ContentLanguage } from "@rezics/i18n";
import { sql } from "drizzle-orm";
import { alias, PgDialect } from "drizzle-orm/pg-core";
import { z } from "zod";

import { getUnitReadCondition } from "../authorization/unit/query";
import { database } from "../database";
import { unit, unitTag, unitTagVoteStat } from "../database/schema";
import { SubjectAssociationEntityTagPreviewLimit } from "../database/schema/contract-values";
import { wilsonLowerBoundSql } from "../tags/ranking";
import { resolvedUnitLocalizationTitle } from "./localization";

export { SubjectAssociationEntityTagPreviewLimit };

const previewTagUnit = alias(unit, "subject_association_preview_tag_unit");
const PreviewRowSchema = z.object({
	entityId: z.string().uuid(),
	tagId: z.string().uuid(),
	title: z.string().nullable(),
});
type PreviewRow = z.infer<typeof PreviewRowSchema>;
export type SubjectAssociationEntityTagPreview = Pick<PreviewRow, "tagId" | "title">;

function compareCodePoints(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * One bounded statement for the top Tags of every requested Entity.
 *
 * The lateral branch is index-addressed by unit_tag's (unit_id, tag_id)
 * primary key and emits at most four rows per Entity. Tag read authorization
 * and localization resolution remain inside the same statement.
 */
export function subjectAssociationEntityTagPreviewStatement(input: {
	readonly entityIds: readonly string[];
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly profileId?: string;
}) {
	const entityIds = [...new Set(input.entityIds)].sort(compareCodePoints);
	if (!entityIds.length) throw new RangeError("Entity Tag preview requires at least one Entity");
	const requestedValues = sql.join(
		entityIds.map((entityId) => sql`(${entityId}::uuid)`),
		sql`, `,
	);
	const confidence = wilsonLowerBoundSql(unitTagVoteStat.score, unitTagVoteStat.voteCount);
	return sql<PreviewRow>`
		with requested_entity(entity_id) as (values ${requestedValues})
		select
			requested_entity.entity_id as "entityId",
			ranked.tag_id as "tagId",
			${resolvedUnitLocalizationTitle(sql`ranked.tag_id`, input.localizationLanguages)} as "title"
		from requested_entity
		cross join lateral (
			select
				${unitTag.tagId} as tag_id,
				row_number() over (
					order by
						${unitTag.pinned} desc,
						case when ${unitTag.pinned} then ${unitTag.position} end asc nulls last,
						${confidence} desc,
						${unitTagVoteStat.score} desc,
						${unitTagVoteStat.voteCount} desc,
						${unitTag.tagId}
				) as preview_rank
			from ${unitTag}
			inner join ${unit} as ${previewTagUnit} on ${previewTagUnit.id} = ${unitTag.tagId}
			left join ${unitTagVoteStat}
				on ${unitTagVoteStat.unitId} = ${unitTag.unitId}
				and ${unitTagVoteStat.tagId} = ${unitTag.tagId}
			where
				${unitTag.unitId} = requested_entity.entity_id
				and ${getUnitReadCondition(input.profileId, {}, previewTagUnit)}
			order by preview_rank
			limit ${SubjectAssociationEntityTagPreviewLimit}
		) as ranked
		order by requested_entity.entity_id, ranked.preview_rank
	`;
}

export async function getSubjectAssociationEntityTagPreviews(
	entityIds: readonly string[],
	localizationLanguages: readonly ContentLanguage[] = [],
	profileId?: string,
): Promise<ReadonlyMap<string, readonly SubjectAssociationEntityTagPreview[]>> {
	if (!entityIds.length) return new Map();
	const result = await database.execute(
		subjectAssociationEntityTagPreviewStatement({
			entityIds,
			localizationLanguages,
			profileId,
		}),
	);
	const previews = new Map<string, SubjectAssociationEntityTagPreview[]>();
	for (const value of result.rows) {
		const row = PreviewRowSchema.parse(value);
		const tags = previews.get(row.entityId) ?? [];
		if (tags.length >= SubjectAssociationEntityTagPreviewLimit)
			throw new Error("Entity Tag preview query exceeded its per-Entity bound");
		tags.push({ tagId: row.tagId, title: row.title });
		previews.set(row.entityId, tags);
	}
	return previews;
}

/** SQL renderer used only by deterministic query-shape tests. @internal */
export function renderSubjectAssociationEntityTagPreviewStatement(
	input: Parameters<typeof subjectAssociationEntityTagPreviewStatement>[0],
) {
	return new PgDialect().sqlToQuery(subjectAssociationEntityTagPreviewStatement(input));
}
