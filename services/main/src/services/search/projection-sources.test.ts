import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CurrentProjectionSources, HistoryProjectionSources } from "./projection-sources";

const migrationDirectory = fileURLToPath(new URL("../database/migrations", import.meta.url));
const currentEnrichment = fileURLToPath(
	new URL("../../../search/rezics_unit_search_document_v1.sql", import.meta.url),
);
const baselineMigration = fileURLToPath(
	new URL("../database/migrations/20260801000000_v1_baseline.sql", import.meta.url),
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
			expect(sql, `missing history source ${table}`).toContain(
				`search_revision_projection_touch_${table}_insert`,
			);
		expect(sql).not.toContain("FOR EACH ROW EXECUTE FUNCTION search_touch");
	});

	it("projects root read grants and current ownership", async () => {
		const sql = await readFile(currentEnrichment, "utf8");
		expect(CurrentProjectionSources).toHaveProperty("unit_access_grant");
		expect(CurrentProjectionSources).toHaveProperty("unit_ownership");
		expect(sql).toContain("FROM public.unit_access_grant");
		expect(sql).toContain("permission = 'unit.read'");
		expect(sql).toContain("scope = array[]::text[]");
		expect(sql).toContain("FROM public.unit_ownership");
	});

	it("projects Series Units into the works category", async () => {
		const sql = await readFile(currentEnrichment, "utf8");
		expect(CurrentProjectionSources).toHaveProperty("series");
		expect(sql).toContain(
			"unit_row.kind IN ('book', 'software', 'media', 'series', 'video', 'audio', 'zone')",
		);
	});

	it("projects only the active immutable Unit content license grant", async () => {
		const [sql, migration] = await Promise.all([
			readFile(currentEnrichment, "utf8"),
			readFile(baselineMigration, "utf8"),
		]);
		expect(sql).toContain(
			"ON content_license_row.unit_id = source.unit_id\n\tAND content_license_row.status = 'active'",
		);
		expect(sql).not.toContain("content_license_row.revoked_at");
		expect(migration).toContain(
			"CREATE TRIGGER search_projection_touch_unit_content_license_update",
		);
		expect(migration).toContain("CREATE TRIGGER unit_content_license_guard_mutation");
	});

	it("projects and invalidates direct or one-Entity-hop Profile credits", async () => {
		const sql = await readFile(currentEnrichment, "utf8");
		expect(sql).toContain("'creditedProfileIds'");
		expect(sql).toContain("AS credited_profile_data");
		expect(sql).toContain("direct_credit.source_unit_id = source.unit_id");
		expect(sql).not.toContain("direct_credit.role = 'publisher'");
		expect(sql).toContain("entity_profile.source_unit_id = credited_entity.id");
		expect(sql).toContain("entity_profile.role = 'publisher'");
		expect(sql).toContain("source_credit.source_unit_id = source.unit_id");
		expect(sql).not.toContain("source_credit.role = 'publisher'");
		const migrations = (
			await Promise.all(
				(await readdir(migrationDirectory))
					.filter((name) => name.endsWith(".sql"))
					.map((name) => readFile(`${migrationDirectory}/${name}`, "utf8")),
			)
		).join("\n");
		expect(migrations).toContain("search_touch_credited_profile_chain_statement");
		expect(migrations).toContain("credited_entity.id = ANY(changed_ids)");
		expect(migrations).toContain("credited_entity.id = ANY(first_sources)");
	});
});
