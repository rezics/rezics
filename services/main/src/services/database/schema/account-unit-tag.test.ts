import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { accountUnitTag } from "./tag";
import { referenceValue } from "./reference-value";
import { UnitReferenceConsumers } from "./unit-reference-consumers";

describe("private Tag canonical references", () => {
	it("stores one target value without an independent native identity", () => {
		const config = getTableConfig(accountUnitTag);
		expect(config.columns.map((column) => column.name)).toEqual([
			"auth_user_id",
			"target_reference_id",
			"tag_id",
			"position",
			"created_at",
			"updated_at",
		]);
		const keys = config.foreignKeys.filter(
			(key) => key.reference().foreignTable === referenceValue,
		);
		expect(keys).toHaveLength(1);
		expect(keys[0]?.onDelete).toBe("restrict");
		expect(config.foreignKeys).toHaveLength(3);
		expect(UnitReferenceConsumers.map((consumer) => consumer.table)).not.toContain(
			"account_unit_tag",
		);
	});
});
