import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

import {
	applyMusicBrainzKeys,
	assertSchemaReferencesComplete,
	assertUniqueSourceFields,
	CatalogSourceValues,
	contractRecord,
	inventoryJsonSchema,
	inventoryMusicBrainz,
	inventoryOpenLibrary,
	inventoryVndb,
	type SourceContractField,
} from "@rezics/schema-importer/readers/provider-contracts";

const directory = fileURLToPath(
	new URL("../src/services/catalog/source-contracts/", import.meta.url),
);
// Bangumi common reuses staff definitions through YAML aliases. Artifacts are
// checksum-pinned before parsing; keep a finite alias budget for those definitions.
const yamlOptions = { maxAliasCount: 10_000 } as const;
const artifactSchema = z.strictObject({
	file: z.string().regex(/^[a-z0-9][a-z0-9._-]+$/u),
	source: z.enum(CatalogSourceValues),
	format: z.enum([
		"openapi",
		"json_schema",
		"vndb",
		"musicbrainz_sql",
		"musicbrainz_foreign_keys",
		"musicbrainz_primary_keys",
		"openlibrary_type",
		"archive",
		"vocabulary",
	]),
	url: z.url(),
	sha256: z.string().regex(/^[a-f0-9]{64}$/u),
});

function sha256(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

/** Read pinned artifacts only; no upstream SQL, Python or wiki text is executed. */
export async function generateCatalogSourceInventory(
	cache: string,
	fetchMissing: boolean,
): Promise<string> {
	const artifacts = z
		.array(artifactSchema)
		.max(128)
		.parse(
			JSON.parse(
				await readFile(
					new URL(
						"../../../libraries/schema-importer/sources/catalog/artifacts.lock.json",
						import.meta.url,
					),
					"utf8",
				),
			),
		);
	let fields: SourceContractField[] = [];
	let musicBrainzForeignKeys: string | undefined;
	let musicBrainzPrimaryKeys: string | undefined;
	const schemaDocuments = new Map<string, unknown>();
	let totalBytes = 0;
	for (const artifact of artifacts) {
		const path = join(cache, artifact.file);
		let bytes: Buffer;
		try {
			bytes = await readFile(
				new URL(
					`../../../libraries/schema-importer/sources/${artifact.source}/inputs/${artifact.file}`,
					import.meta.url,
				),
			).catch(() => readFile(path));
		} catch (error: unknown) {
			if (!fetchMissing || !(error instanceof Error && "code" in error && error.code === "ENOENT"))
				throw error;
			const url = new URL(artifact.url);
			if (
				url.protocol !== "https:" ||
				!["raw.githubusercontent.com", "api.vndb.org"].includes(url.hostname)
			)
				throw new Error(`Unreviewed contract artifact host: ${url.hostname}`);
			const response = await fetch(url, {
				headers: { "User-Agent": "edge/REZICS-schema-audit (2026.09.07; +https://www.rezics.com)" },
				signal: AbortSignal.timeout(30_000),
				redirect: "error",
			});
			if (!response.ok || !response.body)
				throw new Error(`Contract download returned ${response.status}`);
			const chunks: Uint8Array[] = [];
			let length = 0;
			for await (const chunk of response.body) {
				length += chunk.length;
				if (length > 8_000_000) throw new Error("Source contract artifact exceeds 8 MB");
				chunks.push(chunk);
			}
			bytes = Buffer.concat(chunks);
			if (sha256(bytes) !== artifact.sha256)
				throw new Error(`Source contract changed: ${artifact.file}`);
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, bytes);
		}
		totalBytes += bytes.length;
		if (bytes.length > 8_000_000 || totalBytes > 32_000_000)
			throw new Error("Pinned source contracts exceed the reviewed artifact budget");
		if (sha256(bytes) !== artifact.sha256)
			throw new Error(`Source contract checksum differs: ${artifact.file}`);
		const text = bytes.toString("utf8");
		switch (artifact.format) {
			case "vndb":
				fields.push(...inventoryVndb(JSON.parse(text)));
				break;
			case "musicbrainz_sql":
				fields.push(...inventoryMusicBrainz(text));
				break;
			case "musicbrainz_foreign_keys":
				musicBrainzForeignKeys = text;
				break;
			case "musicbrainz_primary_keys":
				musicBrainzPrimaryKeys = text;
				break;
			case "openlibrary_type":
				// Pinned .type files mix JSON with flow maps using single quotes and
				// True/False. This subset is parsed as data, never evaluated as Python.
				fields.push(...inventoryOpenLibrary(parseYaml(text, yamlOptions)));
				break;
			case "openapi": {
				const document = contractRecord(parseYaml(text, yamlOptions));
				schemaDocuments.set(artifact.url, document);
				const components = contractRecord(contractRecord(document.components).schemas);
				for (const [name, schema] of Object.entries(components))
					fields.push(...inventoryJsonSchema("bangumi", `api:${name}`, schema));
				break;
			}
			case "json_schema": {
				const document: unknown = parseYaml(text, yamlOptions);
				schemaDocuments.set(artifact.url, document);
				fields.push(...inventoryJsonSchema("bangumi", `component:${artifact.file}`, document));
				break;
			}
			case "archive": {
				let contract: string | undefined;
				for (const line of text.split(/\r?\n/u)) {
					const heading = /^- .+?[（(]([A-Za-z-]+)[）)]/u.exec(line)?.[1];
					if (heading) contract = `archive:${heading.toLowerCase()}`;
					const field = /^\s*\|\s*`([^`]+)`\s*\|/u.exec(line)?.[1];
					if (field && contract)
						fields.push({
							source: "bangumi",
							contract,
							path: field,
							shape: "documented_value",
							reference: null,
							repeated: null,
							nullable: null,
						});
				}
				break;
			}
			case "vocabulary": {
				// Vocabulary entries are separate contract records; their numeric IDs and
				// nested definitions remain data, not hardcoded application role enums.
				const walk = (value: unknown, path: string, depth: number) => {
					if (depth > 32) throw new Error("Vocabulary nesting exceeds bound");
					if (fields.length > 200_000)
						throw new Error("Source inventory exceeds the reviewed field budget");
					if (Array.isArray(value))
						value.forEach((child, i) => walk(child, `${path}[${i}]`, depth + 1));
					else if (value !== null && typeof value === "object")
						for (const [key, child] of Object.entries(contractRecord(value)))
							walk(child, `${path}.${key}`, depth + 1);
					else
						fields.push({
							source: artifact.source,
							contract: `vocabulary:${artifact.file}`,
							path,
							shape: value === null ? "null" : typeof value,
							reference: null,
							repeated: null,
							nullable: value === null,
						});
				};
				walk(parseYaml(text, yamlOptions), "$", 0);
				break;
			}
		}
	}
	assertSchemaReferencesComplete(schemaDocuments);
	if (!musicBrainzForeignKeys || !musicBrainzPrimaryKeys)
		throw new Error("Missing MusicBrainz key contracts");
	fields = applyMusicBrainzKeys(fields, musicBrainzForeignKeys, musicBrainzPrimaryKeys);
	assertUniqueSourceFields(fields);
	fields.sort((a, b) => {
		const left = JSON.stringify([a.source, a.contract, a.path]);
		const right = JSON.stringify([b.source, b.contract, b.path]);
		return left < right ? -1 : left > right ? 1 : 0;
	});
	return `${fields.map((field) => JSON.stringify(field)).join("\n")}\n`;
}

async function main(): Promise<void> {
	const [cacheArgument, ...flags] = process.argv.slice(2);
	if (!cacheArgument || flags.some((flag) => !["--fetch", "--check"].includes(flag)))
		throw new Error(
			"Usage: generate-catalog-source-inventory.ts <cache-under-.temp> [--fetch] [--check]",
		);
	const cache = resolve(cacheArgument);
	const temporaryRoot = fileURLToPath(new URL("../../../.temp/", import.meta.url));
	if (!cache.startsWith(temporaryRoot))
		throw new Error("Source artifact cache must be under repository .temp/");
	const output = await generateCatalogSourceInventory(cache, flags.includes("--fetch"));
	const target = join(directory, "fields.jsonl");
	if (flags.includes("--check")) {
		if ((await readFile(target, "utf8")) !== output)
			throw new Error("Generated source inventory is stale");
	} else await writeFile(target, output, "utf8");
	console.info(
		`Verified ${output.trimEnd().split("\n").length} pinned source field entries; native mapping qualification is separate`,
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
	void main().catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	});
