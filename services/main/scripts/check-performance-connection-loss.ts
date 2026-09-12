import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { Client } from "pg";
import { z } from "zod";
import { assertOwnedContainer, repositoryRoot } from "./performance/config";
import { exec } from "./performance/tools";

const datasetId = z
	.string()
	.regex(/^[a-f0-9]{16}$/)
	.parse(process.argv[2]);
const container = `rezics-perf-${datasetId}`;
assertOwnedContainer(
	container,
	datasetId,
	JSON.parse(
		(await exec("docker", ["inspect", "--format", "{{json .Config.Labels}}", container])).stdout,
	),
);
const saved = z
	.object({ config: z.object({ rows: z.number().int(), seed: z.number().int() }) })
	.parse(
		JSON.parse(
			await readFile(
				resolve(repositoryRoot, ".temp/performance", datasetId, "report.json"),
				"utf8",
			),
		),
	);
const port = /^127\.0\.0\.1:(\d+)$/.exec(
	(await exec("docker", ["port", container, "5432/tcp"])).stdout.trim(),
)?.[1];
assert.ok(port);
const observer = new Client({
	connectionString: `postgres://postgres:performance-only@127.0.0.1:${port}/rezics_performance`,
});
observer.on("error", () => {});
await observer.connect();
let ended = false;
try {
	// Test the real harness in a child, so an unhandled error cannot masquerade as a report.
	const running = exec(
		process.execPath,
		[
			resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs"),
			resolve(repositoryRoot, "services/main/scripts/performance/run.ts"),
			"--rows",
			String(saved.config.rows),
			"--seed",
			String(saved.config.seed),
			"--case",
			"and-correlated.hot",
			"--jit",
			"off",
			"--reuse",
			datasetId,
		],
		{ cwd: resolve(repositoryRoot, "services/main"), timeout: 180_000, maxBuffer: 4 * 1024 * 1024 },
	)
		.then(
			(result) => ({ code: 0, output: result.stdout + result.stderr }),
			(error) => ({
				code: error.code,
				output: String(error.stdout ?? "") + String(error.stderr ?? ""),
			}),
		)
		.finally(() => {
			ended = true;
		});
	let killedRun: string | undefined;
	for (let attempt = 0; attempt < 1000 && !ended; attempt++) {
		const rows = await observer.query<{
			pid: number;
			application_name: string;
		}>(`select pid,application_name from pg_stat_activity
			where datname=current_database() and application_name like 'rezics-performance:%:admin'
			and state='idle' and backend_start>statement_timestamp()-interval '20 seconds'`);
		assert.ok(
			rows.rows.length <= 1,
			"The isolated fixture requires no other harness using this dataset",
		);
		const row = rows.rows[0];
		if (row) {
			killedRun = /^rezics-performance:([a-f0-9]{16}):admin$/.exec(row.application_name)?.[1];
			assert.ok(killedRun);
			assert.equal(
				(
					await observer.query<{ stopped: boolean }>("select pg_terminate_backend($1) as stopped", [
						row.pid,
					])
				).rows[0]?.stopped,
				true,
			);
			break;
		}
		await setTimeout(10);
	}
	const result = await running;
	assert.ok(killedRun, "Observe and terminate the exact idle harness administrator");
	await writeFile(
		resolve(repositoryRoot, ".temp/performance", killedRun, "connection-loss-fixture.log"),
		result.output,
	);
	assert.notEqual(result.code, 0);
	assert.doesNotMatch(result.output, /Unhandled 'error' event/u);
	const report = JSON.parse(
		await readFile(resolve(repositoryRoot, ".temp/performance", killedRun, "report.json"), "utf8"),
	);
	assert.equal(report.status, "failed");
	assert.ok(report.databaseConnectionError);
	assert.equal(
		report.failureDiagnostics.find((item: { artifact: string }) => item.artifact === "postgres.log")
			?.status,
		"captured",
	);
	console.info(
		JSON.stringify({
			runId: killedRun,
			datasetId,
			checks: 6,
			exactIdleBackendTerminated: true,
			failureReported: true,
			nativeLogCaptured: true,
			unhandledClientError: false,
			datasetPreserved: true,
		}),
	);
} finally {
	await observer.end();
}
