import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { digest } from "@rezics/schema/identity";
import {
	fetchProviderSchemas,
	readProviderAcquisition,
} from "@rezics/content-adapters/acquisition";

import {
	applyMusicBrainzKeys,
	assertSchemaReferencesComplete,
	assertUniqueSourceFields,
	contractRecord,
	inventoryJsonSchema,
	inventoryMusicBrainz,
	inventoryOpenLibrary,
	inventoryVndb,
	type SourceContractField,
} from "@rezics/content-adapters/readers/provider-contracts";

const directory = fileURLToPath(
	new URL("../src/services/catalog/source-contracts/", import.meta.url),
);
// Bangumi common reuses staff definitions through YAML aliases; bound expansion.
const yamlOptions = { maxAliasCount: 10_000 } as const;

/** @internal Inventory one captured run as data; downloaded declarations are never executed. */
export async function generateCatalogSourceInventory() {
	const { receipt, inputs } = await readProviderAcquisition("all");
	let fields: SourceContractField[] = [];
	let musicBrainzForeignKeys: string | undefined;
	let musicBrainzPrimaryKeys: string | undefined;
	const schemaDocuments = new Map<string, unknown>();
	for (const { artifact, text } of inputs) {
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
				// Upstream .type files mix JSON with flow maps using single quotes and
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
	return { receipt, text: `${fields.map((field) => JSON.stringify(field)).join("\n")}\n` };
}

async function main(): Promise<void> {
	const flags = process.argv.slice(2);
	if (flags.some((flag) => !["--fetch", "--check"].includes(flag)))
		throw new Error("Usage: generate-catalog-source-inventory.ts [--fetch] [--check]");
	if (flags.includes("--fetch")) await fetchProviderSchemas("all");
	const { receipt, text } = await generateCatalogSourceInventory();
	const target = join(directory, "fields.jsonl");
	const receiptPath = join(directory, "inventory.json");
	const inventory =
		JSON.stringify(
			{
				format: "rezics.source-inventory.v1",
				acquisition: receipt,
				fieldsSha256: digest(Buffer.from(text)),
			},
			null,
			"\t",
		) + "\n";
	if (flags.includes("--check")) {
		if (
			(await readFile(target, "utf8")) !== text ||
			(await readFile(receiptPath, "utf8")) !== inventory
		)
			throw new Error("Generated source inventory is stale for the captured run");
	} else {
		await writeFile(target, text, "utf8");
		await writeFile(receiptPath, inventory, "utf8");
	}
	console.info(
		`Generated ${text.trimEnd().split("\n").length} source declarations from run ${receipt.runId}; native mapping qualification is separate`,
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
	void main().catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	});
