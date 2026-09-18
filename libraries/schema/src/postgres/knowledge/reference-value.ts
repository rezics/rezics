import { sql, type SQL } from "drizzle-orm";
import { type AnyPgColumn, check, index, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { UnitOwnerValues } from "@rezics/reference";
import { pgTable } from "../shared/base";
import { createUuidv7PrimaryKey } from "../shared/columns";
import {
	unitReferenceColumns,
	unitReferenceTargetColumn,
	unitReferenceIdExpression,
} from "../shared/unit-reference-columns";
import { descriptionObject } from "./descriptions.generated";
import { wikiPage } from "../wiki/pages.generated";
import { mediaItem } from "../media/indexing.generated";
import { schemaTerm } from "../vocabulary/registry.generated";
import { schemaRelation } from "./semantic-relations.generated";

/**
 * Immutable reference values for generic consumers; native owners exist independently.
 * @internal
 */
export const referenceValue = pgTable(
	"reference_value",
	{
		id: createUuidv7PrimaryKey(),
		...unitReferenceColumns("target"),
		targetDescriptionId: uuid().references((): AnyPgColumn => descriptionObject.id, {
			onDelete: "restrict",
		}),
		targetWikiId: uuid().references((): AnyPgColumn => wikiPage.id, { onDelete: "restrict" }),
		targetIndexedMediaId: uuid().references(() => mediaItem.id, { onDelete: "restrict" }),
		targetVocabularyTermId: uuid().references(() => schemaTerm.id, { onDelete: "restrict" }),
		targetSemanticRelationId: uuid().references(() => schemaRelation.id, { onDelete: "restrict" }),
	},
	(table) => [
		index("reference_value_native_id_idx").on(
			sql`coalesce(${unitReferenceIdExpression("target")},${table.targetDescriptionId},${table.targetWikiId},${table.targetIndexedMediaId},${table.targetVocabularyTermId},${table.targetSemanticRelationId})`,
		),
		check(
			"reference_value_target_check",
			sql`num_nonnulls(${sql.join(
				[
					...UnitOwnerValues.map((owner) => unitReferenceTargetColumn("target", owner, table)),
					table.targetDescriptionId,
					table.targetWikiId,
					table.targetIndexedMediaId,
					table.targetVocabularyTermId,
					table.targetSemanticRelationId,
				],
				sql`, `,
			)}) = 1`,
		),
		...UnitOwnerValues.map((owner) => {
			const column = unitReferenceTargetColumn("target", owner, table);
			return uniqueIndex(`reference_value_target_${owner}_key`)
				.on(column)
				.where(sql`${column} is not null`);
		}),
		...(
			[
				["description", table.targetDescriptionId],
				["wiki", table.targetWikiId],
				["indexed_media", table.targetIndexedMediaId],
				["vocabulary_term", table.targetVocabularyTermId],
				["semantic_relation", table.targetSemanticRelationId],
			] as const
		).map(([name, column]) =>
			uniqueIndex(`reference_value_target_${name}_key`)
				.on(column)
				.where(sql`${column} is not null`),
		),
	],
);

type NativeReferenceColumns = NonNullable<
	Parameters<typeof unitReferenceIdExpression<"target">>[1]
> &
	Record<
		| "targetDescriptionId"
		| "targetWikiId"
		| "targetIndexedMediaId"
		| "targetVocabularyTermId"
		| "targetSemanticRelationId",
		AnyPgColumn
	>;

/** Indexed native-ID projection for the entire lazy reference directory, including non-Unit owners. @internal */
export function referenceValueNativeIdExpression(columns: NativeReferenceColumns): SQL {
	return sql`coalesce(${unitReferenceIdExpression("target", columns)},${columns.targetDescriptionId},${columns.targetWikiId},${columns.targetIndexedMediaId},${columns.targetVocabularyTermId},${columns.targetSemanticRelationId})`;
}
