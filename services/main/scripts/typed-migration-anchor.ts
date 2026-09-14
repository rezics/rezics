import { createHash } from "node:crypto";
import { readFile, readdir, rename, writeFile, mkdir, mkdtemp, rm, open } from "node:fs/promises";
import { join, resolve } from "node:path";
import { captureTypedDatabaseSchema } from "./typed-schema-snapshot";
import { operationalPartitionTables } from "./operational-partitions";
import { sourcePartitionKeys } from "./source-partitions";

/** Generated model baseline for offline DDL production; it records no database acceptance. @internal */
export interface TypedMigrationAnchor {
	format: 1;
	baselineDigest: string;
	history: { name: string; digest: string }[];
	partitions: Record<string, string>;
	snapshot: Awaited<ReturnType<typeof captureTypedDatabaseSchema>>;
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
/** Read the exact migration inputs a generated typed model accompanies. @internal */
export async function readTypedMigrationInputs(serviceRoot: string) {
	const directory = join(serviceRoot, "src/services/database/migrations");
	const names = (await readdir(directory)).filter(name => /^\d{14}_.+\.sql$/.test(name)).sort();
	if (names.length === 0) throw new Error("Typed generation requires an existing installation baseline");
	return {
		baselineDigest: digest(await readFile(join(serviceRoot, "src/services/database/baseline.json"), "utf8")),
		history: await Promise.all(names.map(async name => ({ name, digest: digest(await readFile(join(directory, name), "utf8")) }))),
		partitions: {
			...Object.fromEntries(operationalPartitionTables.map(name => [name, "range:routing_bucket:16:64"])),
			...Object.fromEntries(Object.entries(sourcePartitionKeys).map(([name, key]) => [name, `hash:${key}:64`])),
		},
	};
}
function renderAnchor(anchor: TypedMigrationAnchor): string {
	const { ddl, ...snapshotHeader } = anchor.snapshot;
	const header = Object.entries(snapshotHeader).filter(([, value]) => value !== undefined).map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
	return `{
  "format": 1,
  "baselineDigest": ${JSON.stringify(anchor.baselineDigest)},
  "history": [
${anchor.history.map(entry => `    ${JSON.stringify(entry)}`).join(",\n")}
  ],
  "partitions": ${JSON.stringify(anchor.partitions, null, 2).replaceAll("\n", "\n  ")},
  "snapshot": {
${header.join(",\n")},
    "ddl": [
${ddl.map(entity => `      ${JSON.stringify(entity)}`).join(",\n")}
    ]
  }
}\n`;
}
/** Persist a generated anchor atomically after producing its accompanying SQL. @internal */
export async function writeTypedMigrationAnchor(serviceRoot: string, snapshot: TypedMigrationAnchor["snapshot"]) {
	const anchor: TypedMigrationAnchor = { format: 1, ...await readTypedMigrationInputs(serviceRoot), snapshot };
	const path = join(serviceRoot, "src/services/database/typed-schema.generated.json");
	const temporaryRoot = resolve(serviceRoot, "../..", ".temp");
	await mkdir(temporaryRoot, { recursive: true });
	const temporaryDirectory = await mkdtemp(join(temporaryRoot, "typed-anchor-"));
	try {
		const temporary = join(temporaryDirectory, "anchor.json");
		await writeFile(temporary, renderAnchor(anchor), "utf8");
		await rename(temporary, path);
	} finally { await rm(temporaryDirectory, { recursive: true, force: true }); }
}
/** Read only generator-owned data and reject an anchor detached from its SQL history. @internal */
export async function readTypedMigrationAnchor(serviceRoot: string): Promise<TypedMigrationAnchor> {
	const parsed = JSON.parse(await readFile(join(serviceRoot, "src/services/database/typed-schema.generated.json"), "utf8")) as TypedMigrationAnchor;
	if (parsed.format !== 1 || !Array.isArray(parsed.history) || !Array.isArray(parsed.snapshot?.ddl))
		throw new Error("Unsupported typed migration anchor; regenerate it from the owning schema state");
	const current = await readTypedMigrationInputs(serviceRoot);
	if (parsed.baselineDigest !== current.baselineDigest || JSON.stringify(parsed.history) !== JSON.stringify(current.history))
		throw new Error("Typed migration anchor does not match the immutable migration inputs; use the owning replay generator to reconcile SQL and typed state during verification");
	for (const [table, placement] of Object.entries(parsed.partitions))
		if (current.partitions[table] !== placement)
			throw new Error(`Existing physical placement changed for ${table}; its owner must provide an explicit layout migration`);
	return parsed;
}

/** Serialize production artifact writers without stealing another generator's lock. @internal */
export async function withMigrationArtifactLock<T>(serviceRoot: string, work: () => Promise<T>): Promise<T> {
	const temporaryRoot = resolve(serviceRoot, "../..", ".temp");
	await mkdir(temporaryRoot, { recursive: true });
	const path = join(temporaryRoot, "migration-artifact-generation.lock");
	const handle = await open(path, "wx");
	try {
		await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
		return await work();
	} finally { await handle.close(); await rm(path, { force: true }); }
}
