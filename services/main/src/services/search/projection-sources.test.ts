import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CurrentProjectionSources, HistoryProjectionSources } from "./projection-sources";

const migrationDirectory = fileURLToPath(new URL("../database/migrations", import.meta.url));
const currentEnrichment = fileURLToPath(
	new URL("../../../search/rezics_unit_search_document_v9.sql", import.meta.url),
);

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

	it("projects root read grants and current ownership from the access v2 tables", async () => {
		const sql = await readFile(currentEnrichment, "utf8");
		expect(CurrentProjectionSources).toHaveProperty("unit_access_grant");
		expect(CurrentProjectionSources).toHaveProperty("unit_ownership");
		expect(CurrentProjectionSources).not.toHaveProperty("unit_access_binding");
		expect(sql).toContain("FROM public.unit_access_grant");
		expect(sql).toContain("permission = 'unit.read'");
		expect(sql).toContain("scope = array[]::text[]");
		expect(sql).toContain("FROM public.unit_ownership");
		expect(sql).not.toContain("FROM public.unit_access_binding");
	});

	it("invalidates works when an Entity publisher chain changes", async () => {
		const sql = await readFile(currentEnrichment, "utf8");
		expect(sql).toContain("AS publisher_data");
		expect(sql).toContain("entity_profile.source_unit_id = publisher_entity.id");
		const migrations = (
			await Promise.all(
				(await readdir(migrationDirectory))
					.filter((name) => name.endsWith(".sql"))
					.map((name) => readFile(`${migrationDirectory}/${name}`, "utf8")),
			)
		).join("\n");
		expect(migrations).toContain("search_touch_publisher_chain_statement");
	});
});
