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
sourceUrl.searchParams.set("search_path", "public");

const result = await runAtlas([
	"schema",
	"diff",
	"--env",
	"main",
	"--from",
	sourceUrl.toString(),
	"--to",
	"env://schema.src",
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
