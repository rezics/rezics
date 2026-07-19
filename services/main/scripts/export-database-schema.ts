import { generateDrizzleJson, generateMigration } from "drizzle-kit/api-postgres";

import * as schema from "../src/services/database/schema";

async function main(): Promise<void> {
	const [emptySnapshot, desiredSnapshot] = await Promise.all([
		generateDrizzleJson({}),
		generateDrizzleJson(schema),
	]);
	const statements = await generateMigration(emptySnapshot, desiredSnapshot);

	process.stdout.write(`${statements.join("\n")}\n`);
}

void main().catch((error: unknown) => {
	const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
});
