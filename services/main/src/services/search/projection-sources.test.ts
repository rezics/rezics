import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CurrentProjectionSources, HistoryProjectionSources } from "./projection-sources";

const migration = fileURLToPath(
	new URL(
		"../database/migrations/20260720190000_meilisearch_projection_control.sql",
		import.meta.url,
	),
);

describe("search projection source registry", () => {
	it("installs a trigger for every declared current and history source", async () => {
		const sql = await readFile(migration, "utf8");
		for (const table of Object.keys(CurrentProjectionSources))
			expect(
				sql.includes(`'${table}'`) || sql.includes(`"${table}"`),
				`missing current source ${table}`,
			).toBe(true);
		for (const table of Object.keys(HistoryProjectionSources))
			expect(sql, `missing history source ${table}`).toContain(`'${table}'`);
		expect(sql).not.toContain("FOR EACH ROW EXECUTE FUNCTION search_touch");
	});
});
