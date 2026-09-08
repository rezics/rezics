import { generateDrizzleJson, generateMigration } from "drizzle-kit/api-postgres";
import { applyOperationalPartitions } from "./operational-partitions";
import { applySourcePartitions } from "./source-partitions";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { UnitOwnerValues } from "@rezics/reference";
import { UnitReferenceConsumers } from "../src/services/database/schema/unit-reference-consumers";

import * as schema from "../src/services/database/schema";

const MigrationOwnedExpressionIndexes = [
	"unit_localization_pgroonga_metadata_idx",
	"unit_localization_pgroonga_content_idx",
] as const;

export async function exportDatabaseSchema(): Promise<string> {
	const tables = new Map(Object.values(schema).filter(value => is(value, PgTable)).map(table => {
		const config = getTableConfig(table);
		return [config.name, new Set(config.columns.map(column => column.name))] as const;
	}));
	for (const reference of UnitReferenceConsumers) {
		const columns = tables.get(reference.table);
		if (!columns || !columns.has(reference.id))
			throw new Error(`Logical reference registry targets a missing table or input: ${reference.table}.${reference.id}`);
		for (const owner of UnitOwnerValues) {
			const column = `${reference.prefix}_${owner}_id`;
			if (!columns.has(column)) throw new Error(`Logical reference registry lacks its concrete owner alternative: ${reference.table}.${column}`);
		}
	}
	const [emptySnapshot, desiredSnapshot] = await Promise.all([
		generateDrizzleJson({}),
		generateDrizzleJson(schema),
	]);
	const statements = applyOperationalPartitions(
		applySourcePartitions(await generateMigration(emptySnapshot, desiredSnapshot)),
	).filter(
		(statement) =>
			!MigrationOwnedExpressionIndexes.some((indexName) => statement.includes(indexName)),
	);

	return `${statements.join("\n")}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void exportDatabaseSchema().then(sql => process.stdout.write(sql)).catch((error: unknown) => {
	const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
});
