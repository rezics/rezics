import { generateDrizzleJson, generateMigration } from "drizzle-kit/api-postgres";

import * as schema from "../src/services/database/schema";

const MigrationOwnedExpressionIndexes = [
	"unit_localization_pgroonga_metadata_idx",
	"unit_localization_pgroonga_content_idx",
] as const;

async function main(): Promise<void> {
	const [emptySnapshot, desiredSnapshot] = await Promise.all([
		generateDrizzleJson({}),
		generateDrizzleJson(schema),
	]);
	const statements = (await generateMigration(emptySnapshot, desiredSnapshot)).filter(
		(statement) =>
			!MigrationOwnedExpressionIndexes.some((indexName) => statement.includes(indexName)),
	);

	process.stdout.write(`${statements.join("\n")}\n`);
}

void main().catch((error: unknown) => {
	const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
});
