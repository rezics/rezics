import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { entityMeasurement, subjectAssociationJudgment } from "./entity";
import { tagPathVote, unitTagPathApplicationJudgment } from "./tag-path";
import { realmTagJudgment, unitTagJudgment } from "./tag";

const EvidenceTables = [
	unitTagJudgment,
	realmTagJudgment,
	tagPathVote,
	unitTagPathApplicationJudgment,
	subjectAssociationJudgment,
	entityMeasurement,
] as const;
const ContextOwnedCascadeForeignKeys = new Set([
	"entity_measurement_entity_id_entity_id_fk",
	"unit_tag_path_application_judgment_application_id_unit_tag_path_application_id_fk",
]);

function indexedColumnSequences(table: PgTable): readonly (readonly string[])[] {
	const config = getTableConfig(table);
	return [
		...config.primaryKeys.map((key) => key.columns.map((column) => column.name)),
		...config.uniqueConstraints.map((constraint) =>
			constraint.columns.map((column) => column.name),
		),
		...config.indexes.map((index) =>
			index.config.columns.flatMap((column) =>
				"name" in column && typeof column.name === "string" ? [column.name] : [],
			),
		),
	];
}

describe("content-pack evidence retention", () => {
	it("retains evidence roots while contextual Path judgments follow their application", () => {
		for (const table of EvidenceTables) {
			const config = getTableConfig(table);
			expect(
				config.foreignKeys.length,
				`${config.name} must retain its evidence roots`,
			).toBeGreaterThan(0);
			for (const key of config.foreignKeys) {
				const expected = ContextOwnedCascadeForeignKeys.has(key.getName()) ? "cascade" : "restrict";
				expect(key.onDelete, key.getName()).toBe(expected);
			}
		}

		expect(
			getTableConfig(unitTagJudgment).foreignKeys.find(
				(key) => key.getName() === "unit_tag_judgment_unit_tag_fkey",
			)?.onDelete,
		).toBe("restrict");
		expect(
			getTableConfig(realmTagJudgment).foreignKeys.find(
				(key) => key.getName() === "realm_tag_judgment_context_fkey",
			)?.onDelete,
		).toBe("restrict");
		expect(
			getTableConfig(unitTagPathApplicationJudgment).foreignKeys.find(
				(key) =>
					key.getName() ===
					"unit_tag_path_application_judgment_application_id_unit_tag_path_application_id_fk",
			)?.onDelete,
		).toBe("cascade");
	});

	it("left-prefix indexes every strict referencing column set", () => {
		for (const table of EvidenceTables) {
			const config = getTableConfig(table);
			const indexes = indexedColumnSequences(table);
			for (const key of config.foreignKeys) {
				const columns = key.reference().columns.map((column) => column.name);
				expect(
					indexes.some(
						(indexColumns) =>
							indexColumns.length >= columns.length &&
							columns.every((column, position) => indexColumns[position] === column),
					),
					`${key.getName()} needs a selective left-prefix index`,
				).toBe(true);
			}
		}
	});
});
