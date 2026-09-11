import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { availableParallelism, cpus, totalmem } from "node:os";
import { resolve } from "node:path";
import { Client } from "pg";
import { z } from "zod";
import {
	assertOwnedContainer,
	gmarkImage,
	gmarkRevision,
	k6Version,
	parseOptions,
	performanceRoot,
	planningScales,
	postgresImage,
	repositoryRoot,
} from "./config";
import { loadDataset } from "./dataset";
import { coverageReport, summarizePlan } from "./report";
import { ensureK6, exec, prepareDefinitions } from "./tools";
import { queryCases } from "./workload";
import { collectFailureDiagnostics } from "./diagnostics";
import { runSqlLoad } from "./sql-load";

const config = parseOptions(process.argv.slice(2));
const runId = randomBytes(8).toString("hex");
const datasetRunId = config.reuse ?? runId;
const container = `rezics-perf-${datasetRunId}`;
const output = resolve(repositoryRoot, ".temp/performance", runId);
await mkdir(output, { recursive: true });
const cases = queryCases(config);
if (config.mode === "load" && config.rate * config.durationSeconds < cases.length * 20)
	throw new Error("Load duration/rate must provide at least 20 journeys per selected case");
const report: Record<string, unknown> = {
	runId,
	container,
	datasetRunId,
	status: "running",
	config,
	gmarkRevision,
	k6Version,
	postgresImage,
	planningScales,
	scope: "native relationship query performance",
	productionCapacityQualified: false,
	nodeVersion: process.version,
	platform: `${process.platform}-${process.arch}`,
	host: { cpu: cpus()[0]?.model, parallelism: availableParallelism(), memoryBytes: totalmem() },
};
const persist = () => writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
let api: ChildProcess | undefined;
let admin: Client | undefined;
let created = false;

async function stopApi() {
	if (!api?.pid || api.exitCode !== null || api.signalCode !== null) return;
	const processToStop = api;
	await new Promise<void>((resolve) => {
		const timer = setTimeout(() => processToStop.kill("SIGKILL"), 12_000);
		processToStop.once("close", () => {
			clearTimeout(timer);
			resolve();
		});
		processToStop.kill("SIGTERM");
	});
	api = undefined;
}

async function freePort(): Promise<number> {
	const server = createServer();
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Cannot reserve API port");
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	);
	return address.port;
}

try {
	report.revision = (
		await exec("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, windowsHide: true })
	).stdout.trim();
	report.dirty = Boolean(
		(
			await exec("git", ["status", "--porcelain", "--untracked-files=no"], {
				cwd: repositoryRoot,
				windowsHide: true,
			})
		).stdout.trim(),
	);
	await persist();
	console.info(
		`Performance run ${runId}: ${config.rows} resources, ${cases.length} queries (${config.mode}).`,
	);
	const k6 = await ensureK6();
	const bun = process.env.REZICS_BUN_BINARY ?? "bun";
	const bunVersion = (await exec(bun, ["--version"], { windowsHide: true })).stdout.trim();
	report.bunVersion = bunVersion;
	const [bunMajor = 0, bunMinor = 0, bunPatch = 0] = bunVersion.split(".").map(Number);
	if (
		!/^\d+\.\d+\.\d+$/.test(bunVersion) ||
		bunMajor < 1 ||
		(bunMajor === 1 && (bunMinor < 4 || (bunMinor === 4 && bunPatch < 2)))
	)
		throw new Error("Bun 1.4.2 or newer is required");
	const graphPath = resolve(output, "graph0.txt");
	if (config.reuse) {
		const saved = z
			.object({
				config: z.object({ rows: z.number(), seed: z.number() }),
				gmarkRevision: z.string(),
				postgresImage: z.string(),
				graphSha256: z.string(),
				dataset: z.object({ graphEdges: z.number(), relations: z.array(z.unknown()) }),
			})
			.parse(
				JSON.parse(
					await readFile(
						resolve(repositoryRoot, ".temp/performance", datasetRunId, "report.json"),
						"utf8",
					),
				),
			);
		if (
			saved.config.rows !== config.rows ||
			saved.config.seed !== config.seed ||
			saved.gmarkRevision !== gmarkRevision ||
			saved.postgresImage !== postgresImage
		)
			throw new Error("Reused dataset scale, seed or tool versions do not match this run");
		const inspection = await exec(
			"docker",
			["inspect", "--format", "{{json .Config.Labels}}", container],
			{ windowsHide: true },
		);
		assertOwnedContainer(
			container,
			datasetRunId,
			z.record(z.string(), z.string()).parse(JSON.parse(inspection.stdout)),
		);
		report.dataset = saved.dataset;
		report.graphSha256 = saved.graphSha256;
	} else {
		await exec(
			"docker",
			[
				"run",
				"--rm",
				"--mount",
				`type=bind,source=${performanceRoot},target=/config,readonly`,
				"--mount",
				`type=bind,source=${output},target=/work`,
				gmarkImage,
				"-c",
				"/config/relations.xml",
				"-n",
				String(config.rows),
				"-s",
				String(config.seed),
				"-g",
				"/work/graph",
				"-r",
				"/work",
			],
			{ windowsHide: true, timeout: 900_000 },
		);
		// Hash incrementally: corpus-size files must not be read into a single buffer.
		const graphHash = createHash("sha256");
		const { createReadStream } = await import("node:fs");
		for await (const chunk of createReadStream(graphPath)) graphHash.update(chunk);
		report.graphSha256 = graphHash.digest("hex");
		await exec(
			"docker",
			[
				"run",
				"--detach",
				"--name",
				container,
				"--label",
				`org.rezics.performance.run=${runId}`,
				"--label",
				`com.docker.compose.project=${container}`,
				"--publish",
				"127.0.0.1::5432",
				"--ulimit",
				"core=-1",
				"--env",
				"POSTGRES_DB=rezics_performance",
				"--env",
				"POSTGRES_PASSWORD=performance-only",
				postgresImage,
				"postgres",
				"-c",
				"shared_preload_libraries=pg_stat_statements,pgroonga_wal_resource_manager,pgroonga_crash_safer",
				"-c",
				"compute_query_id=on",
				"-c",
				"pg_stat_statements.track=all",
				"-c",
				"track_io_timing=on",
				"-c",
				"track_wal_io_timing=on",
				"-c",
				"max_locks_per_transaction=1024",
				"-c",
				"max_worker_processes=12",
				"-c",
				"max_wal_size=16GB",
				"-c",
				"min_wal_size=4GB",
				"-c",
				"pgroonga.enable_wal_resource_manager=on",
				"-c",
				"pgroonga.enable_crash_safe=on",
				"-c",
				"pgroonga.enable_wal=off",
			],
			{ windowsHide: true },
		);
		created = true;
	}
	const portOutput = (
		await exec("docker", ["port", container, "5432/tcp"], { windowsHide: true })
	).stdout.trim();
	const port = /^127\.0\.0\.1:(\d+)$/.exec(portOutput)?.[1];
	if (!port) throw new Error("Database was not bound to loopback");
	const adminUrl = `postgres://postgres:performance-only@127.0.0.1:${port}/rezics_performance`;
	for (let attempt = 0; attempt < 120; attempt++) {
		const probe = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 1000 });
		try {
			await probe.connect();
			admin = probe;
			break;
		} catch {
			await probe.end().catch(() => {});
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
	if (!admin) throw new Error("The disposable database did not become ready");
	const coreSettings = await exec(
		"docker",
		[
			"exec",
			container,
			"sh",
			"-c",
			"cat /proc/sys/kernel/core_pattern; cat /proc/sys/kernel/core_uses_pid; ulimit -c",
		],
		{ windowsHide: true, timeout: 10_000 },
	);
	report.coreDumpSettings = coreSettings.stdout.trim().split("\n");
	report.databaseImageId = (
		await exec("docker", ["inspect", "--format", "{{.Image}}", container], { windowsHide: true })
	).stdout.trim();
	if (!config.reuse) {
		await admin.end();
		admin = undefined;
		const atlasManifest = JSON.parse(
			await readFile(resolve(repositoryRoot, "packages/atlas/package.json"), "utf8"),
		);
		const atlasVersion = z
			.string()
			.regex(/^\d+\.\d+\.\d+$/)
			.parse(atlasManifest.optionalDependencies["@ariga/atlas"]);
		console.info("Installing the committed migration history on the disposable target.");
		await exec(
			"docker",
			[
				"run",
				"--rm",
				"--network",
				`container:${container}`,
				"--mount",
				`type=bind,source=${resolve(repositoryRoot, "services/main/src/services/database/migrations")},target=/migrations,readonly`,
				`arigaio/atlas:${atlasVersion}`,
				"migrate",
				"apply",
				"--url",
				"postgres://postgres:performance-only@localhost:5432/rezics_performance?sslmode=disable",
				"--dir",
				"file:///migrations",
				"--revisions-schema",
				"public",
			],
			{ cwd: repositoryRoot, windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 900_000 },
		);
		admin = new Client({ connectionString: adminUrl });
		admin.on("error", (error) => {
			report.databaseConnectionError = error.message;
		});
		await admin.connect();
		await admin.query("create extension if not exists pg_stat_statements");
		console.info(
			"Loading generated topology and controlled correlated/anti-correlated relationships.",
		);
		report.dataset = await loadDataset(admin, graphPath, config, () =>
			prepareDefinitions(adminUrl),
		);
	}
	admin.on("error", (error) => {
		report.databaseConnectionError = error.message;
	});
	const receipts = await admin.query<{
		version: string;
		applied: number;
		total: number;
		hash: string;
		error: string | null;
	}>("select version, applied, total, hash, error from atlas_schema_revisions order by version");
	const sums = (
		await readFile(
			resolve(repositoryRoot, "services/main/src/services/database/migrations/atlas.sum"),
			"utf8",
		)
	)
		.split(/\r?\n/)
		.slice(1)
		.filter(Boolean);
	if (
		receipts.rows.length !== sums.length ||
		receipts.rows.some(
			(receipt, index) =>
				receipt.error ||
				receipt.applied !== receipt.total ||
				!sums[index]?.startsWith(`${receipt.version}_`) ||
				!sums[index]?.endsWith(` h1:${receipt.hash}`),
		)
	)
		throw new Error("Dataset migration receipts do not match the committed history");
	if (
		!(await admin.query<{ locked: boolean }>("select pg_try_advisory_lock(2147480000,1) as locked"))
			.rows[0]?.locked
	)
		throw new Error("Another performance run is using this dataset");
	if (!(await admin.query("select 1 from pg_roles where rolname='rezics_perf_reader'")).rowCount)
		await admin.query(
			"create role rezics_perf_reader login password 'performance-reader' nosuperuser nocreatedb nocreaterole",
		);
	await admin.query(
		"grant usage on schema public, approx_count to rezics_perf_reader; grant select on all tables in schema public, approx_count to rezics_perf_reader; grant execute on all functions in schema public, approx_count to rezics_perf_reader",
	);
	await admin.query(`alter role rezics_perf_reader set jit = ${config.jit}`);
	report.databaseSettings = (
		await admin.query(
			"select name, setting, unit from pg_settings where name = any($1::text[]) order by name",
			[
				[
					"shared_buffers",
					"work_mem",
					"maintenance_work_mem",
					"max_connections",
					"max_locks_per_transaction",
					"max_parallel_workers_per_gather",
					"max_worker_processes",
					"jit",
					"jit_above_cost",
					"jit_inline_above_cost",
					"jit_optimize_above_cost",
					"random_page_cost",
					"effective_cache_size",
				],
			],
		)
	).rows;
	const appUrl = `postgres://rezics_perf_reader:performance-reader@127.0.0.1:${port}/rezics_performance`;
	const apiPort = await freePort();
	const origin = `http://127.0.0.1:${apiPort}`;
	const capturePath = resolve(output, "sql.jsonl"),
		casePath = resolve(output, "current-case.txt");
	await writeFile(capturePath, "");
	await writeFile(casePath, "");
	const apiEnvironment = {
		...process.env,
		HOST: "127.0.0.1",
		PORT: String(apiPort),
		DATABASE_URL: appUrl,
		DATABASE_ADMIN_URL: adminUrl,
		BETTER_AUTH_SECRET: "performance-only-secret-that-is-longer-than-thirty-two-characters",
		BETTER_AUTH_URL: origin,
		EMAIL_MODE: "log",
		EMAIL_FROM: "performance@example.invalid",
		S3_ENDPOINT: "http://127.0.0.1:1",
		S3_ACCESS_KEY_ID: "performance",
		S3_SECRET_ACCESS_KEY: "performance",
		S3_BUCKET: "performance",
		REZICS_RELEASE: "development",
		OTEL_SDK_DISABLED: "true",
		OTEL_EXPORTER_OTLP_ENDPOINT: "",
		OTEL_EXPORTER_OTLP_HEADERS: "",
	};
	async function startApi(capture: boolean) {
		const log = createWriteStream(resolve(output, capture ? "api-diagnostic.log" : "api-load.log"));
		api = spawn(
			bun,
			[
				...(capture
					? ["--preload", resolve(repositoryRoot, "services/main/scripts/performance/capture.ts")]
					: []),
				resolve(repositoryRoot, "services/main/src/index.ts"),
			],
			{
				cwd: repositoryRoot,
				windowsHide: true,
				stdio: ["ignore", "pipe", "pipe"],
				env: {
					...apiEnvironment,
					...(capture ? { REZICS_PERF_CAPTURE: capturePath, REZICS_PERF_CASE_FILE: casePath } : {}),
				},
			},
		);
		api.stdout?.pipe(log, { end: false });
		api.stderr?.pipe(log, { end: false });
		api.once("close", () => log.end());
		api.once("error", (error) => log.write(`${error.message}\n`));
		for (let attempt = 0; attempt < 120; attempt++) {
			if (!api.pid || api.exitCode !== null || api.signalCode !== null)
				throw new Error(`API startup failed; see ${log.path}`);
			try {
				const response = await fetch(`${origin}/api/v1/health`, {
					signal: AbortSignal.timeout(1000),
				});
				if (response.ok) return;
			} catch {
				/* Wait for readiness. */
			}
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
		throw new Error("API startup timed out");
	}
	await startApi(true);
	const executed: string[] = [];
	const failures: { caseId: string; status: number; body: string }[] = [];
	report.preflightFailures = failures;
	for (const item of cases) {
		report.currentCase = item.id;
		report.coverage = coverageReport(
			cases.map((item) => item.id),
			executed,
		);
		await writeFile(casePath, item.id);
		const requestBody = structuredClone(item.body);
		let failed = false;
		for (let page = 0; page < item.pages; page++) {
			report.currentPage = page + 1;
			const response = await fetch(`${origin}${item.path}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
				signal: AbortSignal.timeout(35_000),
			});
			const body = await response.text();
			if (response.status !== 200) {
				failures.push({ caseId: item.id, status: response.status, body: body.slice(0, 2000) });
				failed = true;
				break;
			}
			const result = z
				.object({
					groups: z.array(z.object({ hits: z.array(z.unknown()) })),
					nextCursor: z.string().optional(),
				})
				.parse(JSON.parse(body));
			if (!result.nextCursor) break;
			requestBody.state.cursor = result.nextCursor;
		}
		if (!failed) executed.push(item.id);
	}
	delete report.currentCase;
	delete report.currentPage;
	await stopApi();
	report.coverage = coverageReport(
		cases.map((item) => item.id),
		executed,
	);
	report.preflightFailures = failures;
	await persist();
	if (failures.length)
		throw new Error(`${failures.length} query cases failed preflight; see report.json`);
	const captured = z
		.array(
			z.object({
				caseId: z.string(),
				text: z.string(),
				values: z
					.array(z.unknown())
					.nullish()
					.transform((value) => value ?? []),
			}),
		)
		.parse(
			(await readFile(capturePath, "utf8"))
				.trim()
				.split(/\r?\n/)
				.filter(Boolean)
				.map((line) => JSON.parse(line)),
		);
	if (!captured.length) throw new Error("No production SQL was captured");
	const plans: Record<string, unknown>[] = [];
	const unique = new Map(captured.map((query) => [JSON.stringify(query), query]));
	const reader = new Client({ connectionString: appUrl });
	await reader.connect();
	try {
		for (const query of unique.values()) {
			await reader.query("begin read only");
			try {
				await reader.query("set local statement_timeout = '10s'");
				const result = await reader.query(
					`EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON) ${query.text}`,
					query.values,
				);
				plans.push({
					caseId: query.caseId,
					sql: query.text,
					parameters: query.values,
					...summarizePlan(result.rows[0]?.["QUERY PLAN"]),
				});
			} catch (error) {
				plans.push({
					caseId: query.caseId,
					sql: query.text,
					error: error instanceof Error ? error.message : String(error),
				});
			} finally {
				await reader.query("rollback");
			}
		}
	} finally {
		await reader.end();
	}
	await writeFile(resolve(output, "plans.json"), JSON.stringify(plans, null, 2));
	report.planCoverage = {
		captured: captured.length,
		distinct: unique.size,
		explained: plans.filter((plan) => !plan.error).length,
		failed: plans.filter((plan) => plan.error).length,
	};
	if (config.cache === "postgres-restart") {
		await admin.end();
		admin = undefined;
		await exec("docker", ["restart", container], { windowsHide: true });
		for (let attempt = 0; attempt < 120; attempt++) {
			const probe = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 1000 });
			try {
				await probe.connect();
				admin = probe;
				break;
			} catch {
				await probe.end().catch(() => {});
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}
		if (!admin) throw new Error("Database did not recover after the cache experiment restart");
		admin.on("error", (error) => {
			report.databaseConnectionError = error.message;
		});
		if (
			!(
				await admin.query<{ locked: boolean }>(
					"select pg_try_advisory_lock(2147480000,1) as locked",
				)
			).rows[0]?.locked
		)
			throw new Error("Another performance run acquired the dataset during restart");
	}
	report.cacheConditions =
		config.cache === "warm"
			? "Database warmed by diagnostic queries"
			: "PostgreSQL restarted; host OS and storage caches were not cleared";
	await admin.query("select pg_stat_statements_reset()");
	await startApi(false);
	const manifest = {
		...config,
		cases,
		budgets: { journeyP95Ms: config.journeyP95Ms, journeyP99Ms: config.journeyP99Ms },
	};
	const manifestPath = resolve(output, "workload.json"),
		summaryPath = resolve(output, "k6-summary.json");
	await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
	console.info(`Running k6 against the uninstrumented Bun API; output: ${output}`);
	let loadError: unknown;
	try {
		const result = await exec(k6, ["run", resolve(performanceRoot, "k6.js")], {
			cwd: repositoryRoot,
			windowsHide: true,
			timeout: (config.durationSeconds + 1000) * 1000,
			maxBuffer: 8 * 1024 * 1024,
			env: {
				...process.env,
				REZICS_PERF_MANIFEST: manifestPath,
				REZICS_PERF_URL: origin,
				REZICS_PERF_SUMMARY: summaryPath,
			},
		});
		await writeFile(resolve(output, "k6.log"), result.stdout + result.stderr);
		report.k6 = { status: "passed" };
	} catch (error) {
		loadError = error;
		report.k6 = { status: "failed", error: error instanceof Error ? error.message : String(error) };
		if (error && typeof error === "object")
			await writeFile(
				resolve(output, "k6.log"),
				[Reflect.get(error, "stdout"), Reflect.get(error, "stderr")]
					.filter((value) => typeof value === "string")
					.join(""),
			);
	}
	report.sqlStatistics = (
		await admin.query(
			"select queryid::text, query, calls::text, total_exec_time, mean_exec_time, rows::text, shared_blks_hit::text, shared_blks_read::text, temp_blks_written::text from pg_stat_statements where dbid = (select oid from pg_database where datname=current_database()) order by total_exec_time desc limit 100",
		)
	).rows;
	report.postgresVersion = (await admin.query("select version() as version")).rows[0];
	await stopApi();
	if (config.mode === "load" && !loadError)
		report.pgbench = await runSqlLoad(container, output, [...unique.values()]);
	report.status = loadError || plans.some((plan) => plan.error) ? "failed" : "passed";
	await persist();
	if (loadError) throw new Error("k6 thresholds failed; see k6-summary.json", { cause: loadError });
	if (plans.some((plan) => plan.error))
		throw new Error("Some captured SQL could not be qualified; see plans.json");
	console.info(
		`Performance ${config.mode} completed: ${cases.length} cases. This is not a 500M/3B capacity certification.`,
	);
} catch (error) {
	report.status = "failed";
	report.error = error instanceof Error ? error.message : String(error);
	try {
		report.failureDiagnostics = await collectFailureDiagnostics(container, datasetRunId, output);
	} catch (diagnosticError) {
		report.failureDiagnosticsError =
			diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError);
	}
	await persist();
	console.error(report.error);
	process.exitCode = 1;
} finally {
	await stopApi();
	await admin?.end();
	if (created && !config.keep) {
		const inspection = await exec(
			"docker",
			["inspect", "--format", "{{json .Config.Labels}}", container],
			{ windowsHide: true },
		);
		assertOwnedContainer(
			container,
			runId,
			z.record(z.string(), z.string()).parse(JSON.parse(inspection.stdout)),
		);
		await exec("docker", ["rm", "--force", "--volumes", container], { windowsHide: true });
	}
}
