import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { getTableConfig, text, uuid } from "drizzle-orm/pg-core";
import { UnitOwnerValues } from "@rezics/reference";
import { pgTable } from "./base";
import {
	unitReferenceColumns,
	unitReferenceValues,
	unitReferenceConstraints,
	unitReferenceIdExpression,
	unitReferenceOwnerExpression,
	unitOwnerIdColumn,
} from "./unit-reference-columns";

const fixture = pgTable(
	"reference_contract_fixture",
	{
		...unitReferenceColumns("targetUnit"),
		targetUnitId: uuid().notNull().generatedAlwaysAs(unitReferenceIdExpression("targetUnit")),
		targetOwner: text().notNull().generatedAlwaysAs(unitReferenceOwnerExpression("targetUnit")),
	},
	(table) => unitReferenceConstraints("reference_contract_fixture", "targetUnit", table),
);

describe("concrete Unit reference alternatives", () => {
	it("has one concrete owner FK and selective reverse index for every registered owner", () => {
		const config = getTableConfig(fixture);
		expect(config.foreignKeys).toHaveLength(UnitOwnerValues.length);
		expect(config.indexes).toHaveLength(UnitOwnerValues.length);
		for (const owner of UnitOwnerValues) {
			const target = unitOwnerIdColumn(owner);
			expect(
				config.foreignKeys.filter((key) => key.reference().foreignColumns[0] === target),
			).toHaveLength(1);
		}
		expect(
			config.foreignKeys.map((key) => getTableName(key.reference().foreignTable)),
		).not.toContain("unit");
		expect(
			config.foreignKeys.map((key) => getTableName(key.reference().foreignTable)),
		).not.toContain("catalog_unit_locator");
		expect(config.indexes.every((index) => Boolean(index.config.where))).toBe(true);
	});
	it("writes exactly one checked owner alternative and never a derived logical field", () => {
		for (const owner of UnitOwnerValues) {
			const values = unitReferenceValues("targetUnit", {
				owner,
				id: "01992600-0000-7000-8000-000000000001",
			});
			expect(Object.values(values).filter((value) => value !== null)).toEqual([
				"01992600-0000-7000-8000-000000000001",
			]);
			expect(values).not.toHaveProperty("targetUnitId");
			expect(values).not.toHaveProperty("targetOwner");
		}
	});
});
