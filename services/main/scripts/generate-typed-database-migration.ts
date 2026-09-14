import { generateMigration } from "drizzle-kit/api-postgres";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, open } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { captureTypedDatabaseSchema } from "./typed-schema-snapshot";
import { readTypedMigrationAnchor, writeTypedMigrationAnchor, withMigrationArtifactLock } from "./typed-migration-anchor";
import { applyOperationalPartitions } from "./operational-partitions";
import { applySourcePartitions } from "./source-partitions";
import { MigrationOwnedExpressionIndexes } from "./export-database-schema";
import { composeMigrationSql, runMigrationGeneratorCommand } from "./generate-database-migration";
import { PostgreSqlSchemaMigrationBundles } from "../src/services/database/schema/postgres/manifest";

const serviceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = resolve(serviceRoot, "../..");
const anchorPath = join(serviceRoot, "src/services/database/typed-schema.generated.json");
async function exists(path: string) {
	try { await stat(path); return true; }
	catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}
async function optional(path: string) { return await exists(path) ? await readFile(path, "utf8") : undefined; }
async function main() {
	const name = process.argv[2];
	if (name === "--refresh-anchor-format") {
		const previous = await readTypedMigrationAnchor(serviceRoot);
		await writeTypedMigrationAnchor(serviceRoot, previous.snapshot);
		console.info("Regenerated the anchor representation without changing its typed model.");
		return;
	}
	if (name === "--initialize") {
		if (await exists(anchorPath)) throw new Error("A typed migration anchor already exists; initialization cannot overwrite it");
		await writeTypedMigrationAnchor(serviceRoot, await captureTypedDatabaseSchema());
		console.info("Produced the typed schema anchor for the current migration tip; database qualification is unchanged.");
		return;
	}
	if (!name || name.length > 80 || !/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name))
		throw new Error("Usage: generate-typed-database-migration.ts <snake_case_name> | --initialize");
	const previous = await readTypedMigrationAnchor(serviceRoot);
	const next = await captureTypedDatabaseSchema();
	if (previous.snapshot.version !== next.version)
		throw new Error("Drizzle snapshot format changed; reconcile the generator model before producing DDL");
	const sqlDirectory = join(serviceRoot, "src/services/database/schema/postgres");
	const overlays = join(sqlDirectory, "migration-overlays");
	if (await exists(join(overlays, `${name}.shadow-validated.sql`)) || await exists(join(overlays, `${name}.overlay-only`)))
		throw new Error("This migration requires the existing shadow/overlay workflow; do not bypass its admission guards with typed generation");
	const preOverlay = await optional(join(overlays, `${name}.pre.sql`));
	const postOverlay = await optional(join(overlays, `${name}.post.sql`));
	const beforeCanonicalOverlay = await optional(join(overlays, `${name}.before-canonical.sql`));
	const transactionModeNoneReason = await optional(join(overlays, `${name}.txmode-none`));
	const bundle = PostgreSqlSchemaMigrationBundles[name];
	const canonicalPaths = (bundle ?? [`${name.replaceAll("_", "-")}.sql`]).map(file => join(sqlDirectory, file));
	if (bundle && (await Promise.all(canonicalPaths.map(exists))).some(present => !present))
		throw new Error(`Migration bundle ${name} is incomplete`);
	const canonicalSql = (await Promise.all(canonicalPaths.map(optional))).filter((value): value is string => value !== undefined).join("\n\n");
	if (beforeCanonicalOverlay && !canonicalSql) throw new Error("Before-canonical overlay requires canonical SQL");
	// The same Drizzle compiler and partition adapters used for the full schema export
	// produce incremental DDL. No database is opened, replayed or checked here.
	const statements = applyOperationalPartitions(applySourcePartitions(await generateMigration(previous.snapshot, next), false), false)
		.filter(statement => !MigrationOwnedExpressionIndexes.some(index => statement.includes(index)));
	if (!statements.length && !canonicalSql && !preOverlay && !postOverlay)
		throw new Error("No production DDL or canonical SQL was selected for this migration");
	const sqlText = composeMigrationSql({
		schemaDiff: statements.join("\n"),
		...(preOverlay !== undefined ? { preOverlay } : {}),
		...(postOverlay !== undefined ? { postOverlay } : {}),
		...(beforeCanonicalOverlay !== undefined ? { beforeCanonicalOverlay } : {}),
		...(canonicalSql ? { canonicalSql } : {}),
		...(transactionModeNoneReason !== undefined ? { transactionModeNoneReason } : {}),
	});
	const version = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
	if (version <= previous.history.at(-1)!.name.slice(0,14)) throw new Error("Generated migration must sort after the existing tip");
	const migrationDirectory = join(serviceRoot, "src/services/database/migrations");
	const output = join(migrationDirectory, `${version}_${name}.sql`);
	if (await exists(output)) throw new Error("Migration output already exists");
	await mkdir(join(repositoryRoot, ".temp"), { recursive: true });
	const temporary = await mkdtemp(join(repositoryRoot, ".temp/typed-migration-"));
	const checksum = join(migrationDirectory, "atlas.sum");
	await copyFile(checksum, join(temporary, "atlas.sum"));
	await copyFile(anchorPath, join(temporary, "anchor.json"));
	let complete = false;
	let created = false;
	try {
		const handle = await open(output, "wx");
		created = true;
		try { await handle.writeFile(sqlText, "utf8"); } finally { await handle.close(); }
		await runMigrationGeneratorCommand(["exec", "atlas", "migrate", "hash", "--env", "main"], { cwd: serviceRoot });
		await writeTypedMigrationAnchor(serviceRoot, next);
		complete = true;
		console.info(`Produced migration and typed anchor: ${output}; replay and qualification remain pending.`);
	} finally {
		if (!complete && created) {
			await rm(output, { force: true });
			await copyFile(join(temporary, "atlas.sum"), checksum);
			await copyFile(join(temporary, "anchor.json"), anchorPath);
		}
		await rm(temporary, { recursive: true, force: true });
	}
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await withMigrationArtifactLock(serviceRoot, main);
