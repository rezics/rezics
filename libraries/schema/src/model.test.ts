import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "./postgres";
it("exposes the complete production catalogue and keeps hot identities independent of a universal parent", async () => {
	const tables = new Map<string, PgTable>(),
		seen = new Set<unknown>();
	const collect = (value: unknown) => {
		if (is(value, PgTable)) {
			tables.set(getTableConfig(value).name, value);
			return;
		}
		if (value === null || typeof value !== "object" || seen.has(value)) return;
		seen.add(value);
		for (const member of Object.values(value)) collect(member);
	};
	collect(schema);
	const catalogue = JSON.parse(
		await readFile(new URL("../schema-catalogue.generated.json", import.meta.url), "utf8"),
	) as { tableCount: number; tables: { name: string }[] };
	expect([...tables.keys()].sort()).toEqual(catalogue.tables.map((table) => table.name).sort());
	expect(tables.size).toBe(catalogue.tableCount);
	expect(tables.has("unit")).toBe(false);
	for (const table of [
		schema.mediaItem,
		schema.wikiPage,
		schema.message,
		schema.descriptionObject,
	]) {
		const config = getTableConfig(table);
		expect(
			config.foreignKeys
				.filter((key) => key.reference().columns.every((column) => column.notNull))
				.map((key) => getTableConfig(key.reference().foreignTable).name),
		).not.toContain("reference_value");
		expect(config.columns.find((column) => column.name === "id")?.primary).toBe(true);
	}
});
