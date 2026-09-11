import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { sql } from "drizzle-orm";
import { database, withDatabaseTransactionDeadline } from "../src/services/database";
import { createMergedFixtureReference } from "./reference-merge-fixture";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Reference merge requires a disposable loopback target",
);
let concurrentClientWarnings = 0;
const warning = (error: Error) => {
	if (
		error.message.startsWith("Calling client.query() when the client is already executing a query")
	)
		concurrentClientWarnings++;
};
process.on("warning", warning);
const rollback = new Error("rollback reference merge fixture");
try {
	await withDatabaseTransactionDeadline(120000, () =>
		database.transaction(async (tx) => {
			await createMergedFixtureReference(tx);
			throw rollback;
		}),
	);
} catch (error) {
	if (error !== rollback) throw error;
}
await setTimeout(0);
process.off("warning", warning);
assert.equal(
	concurrentClientWarnings,
	0,
	"Merge snapshots must not queue concurrent queries on a transaction client",
);
const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-reference-merge.ts",
	"services/main/scripts/reference-merge-fixture.ts",
	"services/main/src/services/units/merge/service.ts",
	"services/main/src/services/units/merge/manifest.ts",
	"services/main/src/services/units/merge/worker.ts",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(path, repository)))
		.digest("hex");
console.info(
	JSON.stringify({
		baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: fileURLToPath(repository),
			encoding: "utf8",
		}).trim(),
		sourceDigests,
		node: process.version,
		platform: `${process.platform}/${process.arch}`,
		runtime: (
			await database.execute(
				sql`select version() as postgres, current_setting('default_transaction_isolation') as default_isolation`,
			)
		).rows[0],
		publicReviewedCanonicalization: true,
		independentReviewers: 2,
		concurrentClientWarnings,
		rollback: true,
	}),
);
console.info(
	"Verified public reviewed merge canonicalization and sequential snapshot queries; fixture rows rolled back.",
);
process.exit(0);
