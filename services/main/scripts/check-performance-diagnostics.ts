import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, open, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { Client } from "pg";
import { collectFailureDiagnostics } from "./performance/diagnostics";
import { assertOwnedContainer, postgresImage, repositoryRoot } from "./performance/config";
import { exec } from "./performance/tools";

const runId = randomBytes(8).toString("hex"),
	container = `rezics-perf-${runId}`;
const output = resolve(repositoryRoot, ".temp/performance-diagnostics", runId);
await mkdir(output, { recursive: true });
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
		"--ulimit",
		"core=-1",
		"--env",
		"POSTGRES_PASSWORD=diagnostics-only",
		postgresImage,
		"postgres",
		"-c",
		"shared_preload_libraries=pgroonga_wal_resource_manager,pgroonga_crash_safer",
	]);
	created = true;
	const port = /^127\.0\.0\.1:(\d+)$/.exec(
		(await exec("docker", ["port", container, "5432/tcp"])).stdout.trim(),
	)?.[1];
	assert.ok(port);
	const connectionString = `postgres://postgres:diagnostics-only@127.0.0.1:${port}/postgres`;
	async function connectReady() {
		for (let attempt = 0; attempt < 120; attempt++) {
			const connection = new Client({ connectionString, connectionTimeoutMillis: 1000 });
			connection.on("error", () => {});
			try {
				await connection.connect();
				await connection.query("select 1");
				return connection;
			} catch {
				await connection.end().catch(() => {});
				await setTimeout(250);
			}
		}
		throw new Error("Owned diagnostics PostgreSQL did not become ready");
	}
	client = await connectReady();
	await assert.rejects(collectFailureDiagnostics(container, "0000000000000000", output));
	const settings = (
		await exec("docker", [
			"exec",
			container,
			"sh",
			"-c",
			"cat /proc/sys/kernel/core_pattern; cat /proc/sys/kernel/core_uses_pid; ulimit -c",
		])
	).stdout
		.trim()
		.split("\n");
	assert.deepEqual(
		settings,
		["core", "0", "unlimited"],
		"The pinned Docker runtime must write a complete PGDATA/core",
	);
	const pid = (await client.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]!.pid;
	const sleeping = client.query("select pg_sleep(30)");
	const terminated = assert.rejects(sleeping);
	void terminated.catch(() => {});
	await exec("docker", ["exec", container, "kill", "-ABRT", String(pid)]);
	await terminated;
	await client.end();
	let recovered = false;
	for (let attempt = 0; attempt < 120; attempt++) {
		const result = await exec("docker", ["logs", "--tail", "100", container], { timeout: 10_000 });
		const logs = result.stdout + result.stderr;
		const crash = logs.indexOf(`(PID ${pid}) was terminated by signal 6`);
		if (crash >= 0 && logs.lastIndexOf("database system is ready to accept connections") > crash) {
			recovered = true;
			break;
		}
		await setTimeout(250);
	}
	assert.ok(recovered, "Postmaster must complete recovery after the exact killed backend");
	client = await connectReady();
	const diagnostics = await collectFailureDiagnostics(container, runId, output);
	assert.equal(diagnostics.find((item) => item.artifact === "postgres.log")?.status, "captured");
	assert.equal(
		diagnostics.find((item) => item.artifact === "postgres.core")?.status,
		"captured",
		JSON.stringify(diagnostics),
	);
	const core = resolve(output, "postgres.core"),
		metadata = await stat(core);
	assert.ok(metadata.size > 0);
	const file = await open(core, "r");
	try {
		const header = Buffer.alloc(4);
		await file.read(header, 0, 4, 0);
		assert.equal(header.toString("hex"), "7f454c46", "Native core must be an ELF file");
	} finally {
		await file.close();
	}
	console.info(
		JSON.stringify({
			runId,
			postgresImage,
			node: process.version,
			platform: `${process.platform}/${process.arch}`,
			runtime: (await client.query("select version() as postgres")).rows[0],
			settings,
			diagnostics,
			coreBytes: metadata.size,
			checks: 8,
			deliberateOwnedBackendAbort: true,
			applicationSchemaInstalled: false,
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
