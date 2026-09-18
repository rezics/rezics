import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { recommendationExclusion } from "@rezics/schema/postgres/discovery/recommendation";
import { referenceValue } from "@rezics/schema/postgres/knowledge/reference-value";

describe("private recommendation exclusion references", () => {
	it("stores one restrictive canonical reference without an independent native target", () => {
		const config = getTableConfig(recommendationExclusion);
		expect(
			config.columns
				.map((column) => column.name)
				.filter(
					(name) => name === "unit_id" || name.startsWith("unit_") || name.startsWith("target_"),
				),
		).toEqual(["target_reference_id"]);
		const keys = config.foreignKeys.filter(
			(key) => key.reference().foreignTable === referenceValue,
		);
		expect(keys).toHaveLength(1);
		expect(keys[0]?.onDelete).toBe("restrict");
		expect(config.foreignKeys).toHaveLength(2);
		expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			"auth_user_id",
			"target_reference_id",
		]);
	});
});
