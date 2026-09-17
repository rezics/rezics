import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const directories = (await readdir(resolve(root, "migrations"), { withFileTypes: true }))
	.filter((entry) => entry.isDirectory() && entry.name.endsWith("_schema_integrity"))
	.map((entry) => entry.name)
	.sort();
const latest = directories.at(-1);
if (!latest) throw new Error("Generate a custom schema_integrity migration first");
const path = resolve(root, "migrations", latest, "migration.sql");
const existing = await readFile(path, "utf8");
if (existing.replace(/--[^\n]*/gu, "").trim())
	throw new Error("Refusing to overwrite a populated migration");
await writeFile(path, await readFile(resolve(root, "sql/immutability.sql")));
