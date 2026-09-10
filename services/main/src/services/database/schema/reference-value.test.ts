import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { UnitOwnerValues } from "@rezics/reference";
import { referenceValue } from "./reference-value";
import { unitOwnerIdColumn } from "./unit-reference-columns";

describe("canonical reference values", () => {
	it("registers every concrete owner with one restrictive FK and one partial unique index", () => {
		const config = getTableConfig(referenceValue);
		expect(config.columns).toHaveLength(1 + UnitOwnerValues.length);
		expect(config.checks).toHaveLength(1);
		expect(config.foreignKeys).toHaveLength(UnitOwnerValues.length);
		expect(config.indexes).toHaveLength(UnitOwnerValues.length);
		for (const owner of UnitOwnerValues) {
			const keys = config.foreignKeys.filter(
				(key) => key.reference().foreignColumns[0] === unitOwnerIdColumn(owner),
			);
			expect(keys).toHaveLength(1);
			expect(keys[0]?.onDelete).toBe("restrict");
		}
		expect(config.indexes.every((index) => index.config.unique && index.config.where)).toBe(true);
		expect(
			config.foreignKeys.map((key) => getTableName(key.reference().foreignTable)),
		).not.toContain("catalog_unit_locator");
	});
});
