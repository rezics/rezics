import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { UnitOwnerValues } from "@rezics/reference";
import {
	descriptionObject,
	wikiPage,
	mediaItem,
	schemaTerm,
	schemaRelation,
} from "@rezics/schema/postgres";
import { referenceValue } from "@rezics/schema/postgres/knowledge/reference-value";
import { unitOwnerIdColumn } from "@rezics/schema/postgres/shared/unit-reference-columns";

describe("canonical reference values", () => {
	it("registers every concrete owner with one restrictive FK and one partial unique index", () => {
		const config = getTableConfig(referenceValue);
		const semanticTargets = [
			descriptionObject.id,
			wikiPage.id,
			mediaItem.id,
			schemaTerm.id,
			schemaRelation.id,
		];
		const targetCount = UnitOwnerValues.length + semanticTargets.length;
		expect(config.columns).toHaveLength(1 + targetCount);
		expect(config.checks).toHaveLength(1);
		expect(config.foreignKeys).toHaveLength(targetCount);
		expect(config.indexes).toHaveLength(targetCount + 1);
		for (const owner of UnitOwnerValues) {
			const keys = config.foreignKeys.filter(
				(key) => key.reference().foreignColumns[0] === unitOwnerIdColumn(owner),
			);
			expect(keys).toHaveLength(1);
			expect(keys[0]?.onDelete).toBe("restrict");
		}
		for (const column of semanticTargets) {
			const keys = config.foreignKeys.filter((key) => key.reference().foreignColumns[0] === column);
			expect(keys).toHaveLength(1);
			expect(keys[0]?.onDelete).toBe("restrict");
		}
		expect(
			config.indexes.filter((index) => index.config.unique && index.config.where),
		).toHaveLength(targetCount);
		const nativeIndex = config.indexes.find(
			(index) => index.config.name === "reference_value_native_id_idx",
		);
		expect(nativeIndex).toBeDefined();
		expect(nativeIndex?.config.unique).toBe(false);
		expect(
			config.foreignKeys.map((key) => getTableName(key.reference().foreignTable)),
		).not.toContain("catalog_unit_locator");
	});
});
