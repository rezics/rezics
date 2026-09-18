import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { digest, schemaId, stableJson } from "@rezics/schema/identity";
import {
	inventoryMusicBrainz,
	inventoryOpenLibrary,
	inventoryVndb,
	applyMusicBrainzKeys,
	normalizeProviderArtifact,
	type SourceContractField,
} from "./readers/provider-contracts";
import { convertJsonSchema, convertOpenApi, readSchemaDocument } from "./readers/json-schema";
import type { ConvertedContract } from "./model";
import { readPostgresDeclarations } from "./readers/postgres-ddl";
import { convertBangumiArchive, convertBangumiVocabulary } from "./readers/bangumi";

const root = fileURLToPath(new URL("../", import.meta.url));
const artifact = z
	.strictObject({
		file: z.string().regex(/^[a-z0-9][a-z0-9._-]+$/),
		source: z.enum(["bangumi", "vndb", "musicbrainz", "openlibrary"]),
		format: z.string(),
		url: z.url(),
		tracking: z.literal("latest").optional(),
		sha256: z
			.string()
			.regex(/^[a-f0-9]{64}$/)
			.nullable(),
	})
	.refine(
		(entry) =>
			entry.tracking === "latest"
				? entry.source === "vndb" && entry.format === "vndb" && entry.sha256 === null
				: entry.sha256 !== null,
		{ message: "Only the live VNDB schema may omit a SHA-256 pin" },
	);
export async function providerArtifacts() {
	return z
		.array(artifact)
		.parse(
			JSON.parse(await readFile(resolve(root, "contracts/catalog/artifacts.lock.json"), "utf8")),
		);
}

/** @alpha Fetch pinned inputs and the live VNDB schema; downloaded SQL and expressions are never evaluated. */
export async function fetchProviderSchemas(source = "all") {
	z.enum(["all", "bangumi", "musicbrainz", "vndb", "openlibrary"]).parse(source);
	for (const entry of await providerArtifacts()) {
		if (source !== "all" && source !== entry.source) continue;
		const path = resolve(root, "contracts", entry.source, "inputs", entry.file);
		if (entry.sha256 !== null) {
			try {
				const cached = await readFile(path);
				const normalized = normalizeProviderArtifact(entry.format, cached);
				if (digest(normalized) === entry.sha256) {
					if (digest(cached) !== entry.sha256) await writeFile(path, normalized);
					continue;
				}
			} catch (error) {
				if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
			}
		}
		const response = await fetch(entry.url, {
			signal: AbortSignal.timeout(30_000),
			redirect: "error",
			headers: { "User-Agent": "REZICS-schema/2 (+https://rezics.com)" },
		});
		if (!response.ok || !response.body)
			throw new Error(`Schema fetch failed: ${entry.source}/${entry.file}: ${response.status}`);
		const parts: Uint8Array[] = [];
		let size = 0;
		for await (const part of response.body) {
			size += part.byteLength;
			if (size > 8_388_608) throw new RangeError("Schema artifact exceeds 8 MiB");
			parts.push(part);
		}
		const bytes = normalizeProviderArtifact(entry.format, Buffer.concat(parts));
		if (entry.sha256 !== null && digest(bytes) !== entry.sha256)
			throw new TypeError(`Pinned schema changed: ${entry.file}`);
		if (entry.tracking === "latest") inventoryVndb(JSON.parse(bytes.toString("utf8")));
		await mkdir(resolve(path, ".."), { recursive: true });
		await writeFile(path, bytes);
	}
}

function fromFields(
	input: { source: string; origin: string; version: string; file: string; text: string },
	fields: SourceContractField[],
): ConvertedContract[] {
	const grouped = new Map<string, SourceContractField[]>();
	for (const field of fields) {
		const values = grouped.get(field.contract) ?? [];
		values.push(field);
		grouped.set(field.contract, values);
	}
	return [...grouped].map(([name, fields]) => {
		const hash = digest(stableJson(fields));
		return {
			id: schemaId("schema-contract", input.source, name, input.version, hash),
			source: input.source,
			name,
			version: input.version,
			origin: input.origin,
			dialect: input.file.endsWith(".sql") ? "postgresql" : "provider-model",
			digest: hash,
			fields: fields.map((field) => ({
				id: schemaId("schema-field", input.source, name, field.path),
				path: field.path,
				shape: field.shape,
				required: "unspecified" as const,
				cardinality:
					field.repeated === null
						? ("unspecified" as const)
						: field.repeated
							? ("many" as const)
							: ("one" as const),
				nullability:
					field.nullable === null
						? ("unspecified" as const)
						: field.nullable
							? ("nullable" as const)
							: ("non-null" as const),
				references: field.reference
					? [{ kind: "source-reference", value: field.reference, target: null }]
					: [],
				keywords: [{ key: "sourceDeclaration", value: field }],
			})),
		};
	});
}

/** @alpha Convert every selected provider contract and retain its full structured syntax alongside field declarations. */
export async function convertProviderSchemas(source = "all"): Promise<ConvertedContract[]> {
	z.enum(["all", "bangumi", "musicbrainz", "vndb", "openlibrary"]).parse(source);
	const artifacts = await providerArtifacts(),
		result: ConvertedContract[] = [];
	const texts = new Map<string, string>();
	for (const entry of artifacts) {
		if (source !== "all" && source !== entry.source) continue;
		const bytes = normalizeProviderArtifact(
			entry.format,
			await readFile(resolve(root, "contracts", entry.source, "inputs", entry.file)),
		);
		if (bytes.byteLength > 8_388_608 || (entry.sha256 !== null && digest(bytes) !== entry.sha256))
			throw new TypeError(`Schema artifact drift: ${entry.file}`);
		texts.set(entry.file, new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	}
	for (const entry of artifacts) {
		const text = texts.get(entry.file);
		if (text === undefined) continue;
		const input = {
			source: entry.source,
			origin: entry.url,
			version: entry.sha256 ?? digest(Buffer.from(text)),
			file: entry.file,
			text,
		};
		if (entry.format === "archive") {
			result.push(...convertBangumiArchive(input));
			continue;
		}
		if (entry.format === "vocabulary") {
			result.push(convertBangumiVocabulary(input));
			continue;
		}
		if (entry.format === "openapi") {
			result.push(...convertOpenApi(input));
			continue;
		}
		if (entry.format === "json_schema") {
			const parsed = readSchemaDocument(text);
			result.push(
				convertJsonSchema({
					...input,
					name: entry.file,
					schema: parsed.document,
					syntax: parsed.syntax,
				}),
			);
			continue;
		}
		if (entry.format === "musicbrainz_foreign_keys" || entry.format === "musicbrainz_primary_keys")
			continue;
		let fields: SourceContractField[];
		if (entry.format === "musicbrainz_sql") {
			const foreign = artifacts.find((a) => a.format === "musicbrainz_foreign_keys"),
				primary = artifacts.find((a) => a.format === "musicbrainz_primary_keys");
			if (!foreign || !primary) throw new TypeError("MusicBrainz requires both key declarations");
			fields = applyMusicBrainzKeys(
				inventoryMusicBrainz(text),
				texts.get(foreign.file)!,
				texts.get(primary.file)!,
			);
		} else if (entry.format === "vndb") fields = inventoryVndb(JSON.parse(text));
		else if (entry.format === "openlibrary_type")
			fields = inventoryOpenLibrary(readSchemaDocument(text).document);
		else {
			// Provider vocabulary and archive declarations remain fully represented, not discarded wrappers.
			const parsed =
				entry.format === "archive"
					? { document: { documentation: text }, syntax: { kind: "text", value: text } }
					: readSchemaDocument(text);
			result.push(
				convertJsonSchema({
					...input,
					name: entry.file,
					schema: parsed.document,
					syntax: parsed.syntax,
				}),
			);
			continue;
		}
		const converted = fromFields(input, fields);
		if (entry.format === "openlibrary_type") {
			const document = z.record(z.string(), z.unknown()).parse(readSchemaDocument(text).document);
			const contract = converted[0];
			if (contract)
				for (const item of z
					.array(z.record(z.string(), z.unknown()))
					.parse(document.backreferences ?? [])) {
					const path = `backreferences/${z.string().parse(item.name)}`,
						expected = z.record(z.string(), z.unknown()).parse(item.expected_type);
					contract.fields.push({
						id: schemaId("schema-field", input.source, contract.name, path),
						path,
						shape: "reverse-reference",
						required: "unspecified",
						cardinality: "many",
						nullability: "unspecified",
						references: [
							{
								kind: "reverse-property",
								value: `${z.string().parse(expected.key)}.${z.string().parse(item.property_name)}`,
								target: null,
							},
						],
						keywords: [{ key: "sourceDeclaration", value: item }],
					});
				}
		}
		if (entry.format === "vndb" || entry.format === "openlibrary_type") {
			const parsed = readSchemaDocument(text);
			result.push(
				convertJsonSchema({
					...input,
					name: `document:${entry.file}`,
					schema: parsed.document,
					syntax: parsed.syntax,
				}),
			);
		}
		if (entry.format === "musicbrainz_sql") {
			const keySql = artifacts
				.filter((a) => a.source === "musicbrainz" && a.format !== "musicbrainz_sql")
				.map((a) => texts.get(a.file) ?? "");
			const declarations = readPostgresDeclarations(text, keySql);
			for (const contract of converted) {
				const declaration = declarations.get(contract.name);
				if (!declaration) continue;
				for (const field of contract.fields) {
					const column = declaration.columns.get(field.path);
					if (column) {
						field.nullability = column.nullable ? "nullable" : "non-null";
						field.keywords.push({ key: "sql:column", value: column });
					}
				}
				contract.fields.push({
					id: schemaId("schema-field", input.source, contract.name, "$table"),
					path: "$table",
					shape: "table",
					required: "unspecified",
					cardinality: "many",
					nullability: "non-null",
					references: [],
					keywords: declaration.clauses.map((value) => ({ key: "sql:constraint", value })),
				});
			}
		}
		for (const contract of converted) {
			contract.digest = digest(stableJson(contract.fields));
			contract.id = schemaId(
				"schema-contract",
				contract.source,
				contract.name,
				contract.version,
				contract.digest,
			);
		}
		result.push(...converted);
	}
	return result.sort((a, b) => a.id.localeCompare(b.id));
}
