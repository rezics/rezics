import { expect, test } from "vitest";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api-postgres";
import * as schema from "../src/services/database/schema";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { applySourcePartitions, sourcePartitionKeys } from "./source-partitions";

test("source partition export preserves every typed key and complete hash coverage", async () => {
	const sourceTables = Object.fromEntries(
		Object.entries(schema).filter(
			([, value]) => is(value, PgTable) && Object.hasOwn(sourcePartitionKeys, getTableName(value)),
		),
	);
	const original = await generateMigration(
		await generateDrizzleJson({}),
		await generateDrizzleJson(sourceTables),
	);
	const statements = applySourcePartitions(original);
	for (const [table, key] of Object.entries(sourcePartitionKeys)) {
		const parent = statements.find((statement) =>
			statement.startsWith(`CREATE TABLE "${table}" (`),
		);
		expect(parent?.endsWith(`PARTITION BY HASH ("${key}");`)).toBe(true);
		for (let remainder = 0; remainder < 64; remainder++)
			expect(statements).toContain(
				`CREATE TABLE "${table}_p${String(remainder).padStart(2, "0")}" PARTITION OF "${table}" FOR VALUES WITH (MODULUS 64, REMAINDER ${remainder});`,
			);
	}
	expect(statements.filter((statement) => statement.startsWith("ALTER TABLE"))).toEqual(
		original.filter((statement) => statement.startsWith("ALTER TABLE")),
	);
	expect(() => applySourcePartitions([])).toThrow("missing");
});
