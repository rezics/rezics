import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { Client } from "pg";
import { assertOwnedContainer, postgresImage, repositoryRoot } from "./performance/config";
import { exec } from "./performance/tools";
import { runSqlLoad } from "./performance/sql-load";

const runId = randomBytes(8).toString("hex"),
	container = `rezics-perf-${runId}`;
const output = resolve(repositoryRoot, ".temp/performance-sql-replay", runId);
await mkdir(output, { recursive: true });
for (const phase of ["first", "changed", "recovered"]) await mkdir(resolve(output, phase));
let created = false,
	client: Client | undefined;
try {
	await exec("docker", [
		"run",
		"--detach",
		"--name",
		container,
		"--label",
		`org.rezics.performance.run=${runId}`,
		"--publish",
		"127.0.0.1::5432",
		"--env",
		"POSTGRES_PASSWORD=replay-only",
		"--env",
		"POSTGRES_DB=rezics_performance",
		postgresImage,
	]);
	created = true;
	const port = /^127\.0\.0\.1:(\d+)$/.exec(
		(await exec("docker", ["port", container, "5432/tcp"])).stdout.trim(),
	)?.[1];
	assert.ok(port);
	for (let attempt = 0; attempt < 120; attempt++) {
		const connection = new Client({
			connectionString: `postgres://postgres:replay-only@127.0.0.1:${port}/rezics_performance`,
			connectionTimeoutMillis: 1000,
		});
		connection.on("error", () => {});
		try {
			await connection.connect();
			await connection.query("select 1");
			client = connection;
			break;
		} catch {
			await connection.end().catch(() => {});
			await setTimeout(250);
		}
	}
	assert.ok(client, "Owned SQL replay database must become ready");
	await client.query("create role rezics_perf_reader login nosuperuser nocreatedb nocreaterole");
	const first = await runSqlLoad(container, resolve(output, "first"), [
		{ caseId: "probe", text: "SELECT $1::integer", values: [1] },
	]);
	assert.equal(first.failedTransactions, 0);
	await assert.rejects(
		runSqlLoad(container, resolve(output, "changed"), [
			{ caseId: "probe", text: "SELECT 1 / $1::integer", values: [0] },
		]),
	);
	const failureLog = await readFile(resolve(output, "changed/pgbench.log"), "utf8");
	assert.match(
		failureLog,
		/division by zero/u,
		"The failed changed query must be retained in its native log",
	);
	const recovered = await runSqlLoad(container, resolve(output, "recovered"), [
		{ caseId: "probe", text: "SELECT $1::integer", values: [2] },
	]);
	assert.equal(recovered.failedTransactions, 0);
	console.info(
		JSON.stringify({
			runId,
			checks: 4,
			reusedContainerUsesCurrentSql: true,
			failedNativeLogRetained: true,
			changedSqlRejected: true,
			laterValidSqlRecovers: true,
			applicationSchemaInstalled: false,
			postgres: (await client.query("select version() as version")).rows[0]?.version,
		}),
	);
} finally {
	await client?.end().catch(() => {});
	if (created) {
		const labels = JSON.parse(
			(await exec("docker", ["inspect", "--format", "{{json .Config.Labels}}", container])).stdout,
		);
		assertOwnedContainer(container, runId, labels);
		await exec("docker", ["rm", "--force", "--volumes", container]);
	}
}
