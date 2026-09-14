import { generateDrizzleJson, generateMigration } from "drizzle-kit/api-postgres";
import { applyOperationalPartitions } from "./operational-partitions";
import { applySourcePartitions } from "./source-partitions";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { captureTypedDatabaseSchema } from "./typed-schema-snapshot";

/** Expression indexes whose physical definitions remain migration-owned. @internal */
export const MigrationOwnedExpressionIndexes = [
	"unit_localization_pgroonga_metadata_idx",
	"unit_localization_pgroonga_content_idx",
] as const;

export async function exportDatabaseSchema(): Promise<string> {
	const [emptySnapshot, desiredSnapshot] = await Promise.all([
		generateDrizzleJson({}),
		captureTypedDatabaseSchema(),
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
