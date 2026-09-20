import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";

const SyncedMessage = "Schemas are synced, no changes to be made.";

async function runAtlas(arguments_: readonly string[]): Promise<string> {
	const isWindows = process.platform === "win32";
	const yarnCli = isWindows
		? resolve(dirname(process.execPath), "node_modules/corepack/dist/yarn.js")
		: undefined;
	const command = yarnCli ? process.execPath : "yarn";
	const childArguments = yarnCli
		? [yarnCli, "exec", "atlas", ...arguments_]
		: ["exec", "atlas", ...arguments_];
	return await new Promise((resolvePromise, reject) => {
		const child = spawn(command, childArguments, {
			cwd: resolve(import.meta.dirname, ".."),
			stdio: ["ignore", "pipe", "inherit"],
			windowsHide: true,
		});
		const output: Buffer[] = [];
		child.stdout.on("data", (chunk: Buffer) => output.push(chunk));
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (code === 0) resolvePromise(Buffer.concat(output).toString("utf8"));
			else reject(new Error(`Atlas exited with ${signal ?? `code ${String(code)}`}`));
		});
	});
}

const connectionString = process.env.DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("DATABASE_ADMIN_URL is required");
const sourceUrl = new URL(connectionString);
if (!["postgres:", "postgresql:"].includes(sourceUrl.protocol))
	throw new Error("DATABASE_ADMIN_URL must use the PostgreSQL protocol");
// Atlas compares metadata for thousands of native tables/constraints. Parallel
// catalog scans can exhaust a small fixture container's DSM; this offline check
// proves structural equality, not query-planner or workload performance.
function configureCatalogInspection(url: URL): void {
	url.searchParams.set("search_path", "public");
	url.searchParams.set(
		"options",
		`${url.searchParams.get("options") ?? ""} -c max_parallel_workers_per_gather=0`.trim(),
	);
}
configureCatalogInspection(sourceUrl);
const devUrlInput = process.env.ATLAS_DEV_DATABASE_URL;
const devArguments: string[] = [];
if (devUrlInput) {
	const devUrl = new URL(devUrlInput);
	if (
		!["postgres:", "postgresql:"].includes(devUrl.protocol) ||
		!["localhost", "127.0.0.1", "[::1]"].includes(devUrl.hostname) ||
		devUrl.port === "15432" ||
		!/^\/rezics_atlas_(?:dev(?:_|$)|[a-z0-9_]*diffdev(?:_|$))/u.test(devUrl.pathname)
	)
		throw new Error("Atlas normalization requires an explicit disposable loopback dev database");
	if (devUrl.port === sourceUrl.port && devUrl.pathname === sourceUrl.pathname)
		throw new Error("Atlas dev database must differ from the schema being checked");
	configureCatalogInspection(devUrl);
	devArguments.push("--dev-url", devUrl.toString());
}

const result = await runAtlas([
	"schema",
	"diff",
	"--env",
	"main",
	"--from",
	sourceUrl.toString(),
	"--to",
	"env://schema.src",
	...devArguments,
	"--exclude",
	"atlas_schema_revisions",
	"--exclude",
	"*[type=extension|function|trigger]",
	"--exclude",
	"unit_localization.unit_localization_pgroonga_*[type=index]",
]);
if (result.trim() !== SyncedMessage) {
	process.stderr.write(result);
	throw new Error("Migration replay does not match the Drizzle schema");
}
console.info(SyncedMessage);
