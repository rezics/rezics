import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CurrentProjectionSources, HistoryProjectionSources } from "./projection-sources";

const migrationDirectory = fileURLToPath(new URL("../database/migrations", import.meta.url));

describe("search projection source registry", () => {
	it("installs a trigger for every declared current and history source", async () => {
		const migrationFiles = (await readdir(migrationDirectory))
			.filter((name) => name.endsWith(".sql"))
			.sort();
		const sql = (
			await Promise.all(
				migrationFiles.map((name) => readFile(`${migrationDirectory}/${name}`, "utf8")),
			)
		).join("\n");
		for (const table of Object.keys(CurrentProjectionSources))
			expect(
				sql.includes(`('${table}', ARRAY`) ||
					sql.includes(`('${table}')`) ||
					sql.includes(`search_projection_touch_${table}_insert`),
				`missing current source ${table}`,
			).toBe(true);
		for (const table of Object.keys(HistoryProjectionSources))
			expect(sql, `missing history source ${table}`).toContain(`'${table}'`);
		expect(sql).not.toContain("FOR EACH ROW EXECUTE FUNCTION search_touch");
	});
});
