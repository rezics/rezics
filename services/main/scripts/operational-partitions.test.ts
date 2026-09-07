import { expect, test } from "vitest";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api-postgres";
import * as schema from "../src/services/database/schema/operational-durability";
import { applyOperationalPartitions, operationalPartitionTables } from "./operational-partitions";

test("partition export preserves typed keys and creates every nonoverlapping routing range", async () => {
	const original = await generateMigration(
		await generateDrizzleJson({}),
		await generateDrizzleJson(schema),
	);
	const statements = applyOperationalPartitions(original);
	for (const table of operationalPartitionTables) {
		expect(statements.filter((s) => s.startsWith(`CREATE TABLE "${table}_p`))).toHaveLength(64);
		expect(
			statements.some(
				(s) =>
					s.startsWith(`CREATE TABLE "${table}"`) &&
					s.endsWith('PARTITION BY RANGE ("routing_bucket");'),
			),
		).toBe(true);
	}
	expect(statements.filter((s) => s.startsWith("ALTER TABLE"))).toEqual(
		original.filter((s) => s.startsWith("ALTER TABLE")),
	);
	expect(() => applyOperationalPartitions([])).toThrow("missing");
});
