import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { accountFavorite, accountFavoriteRevision } from "@rezics/schema/postgres/community/favorites";
import { referenceValue } from "@rezics/schema/postgres/knowledge/reference-value";

describe("Favorites canonical references", () => {
	for (const table of [accountFavorite, accountFavoriteRevision]) {
		it(`${getTableName(table)} has one restrictive reference FK and no independent target identity`, () => {
			const config = getTableConfig(table);
			expect(
				config.columns.map((column) => column.name).filter((name) => name.startsWith("target_")),
			).toEqual(["target_reference_id"]);
			const keys = config.foreignKeys.filter(
				(key) => key.reference().foreignTable === referenceValue,
			);
			expect(keys).toHaveLength(1);
			expect(keys[0]?.onDelete).toBe("restrict");
			expect(config.foreignKeys).toHaveLength(2);
		});
	}
});
