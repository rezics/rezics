import { z } from "zod";
import { digest, schemaId, stableJson } from "@rezics/schema/identity";
import {
	inventoryMusicBrainz,
	inventoryOpenLibrary,
	inventoryVndb,
	applyMusicBrainzKeys,
	type SourceContractField,
} from "./readers/provider-contracts";
import { convertJsonSchema, convertOpenApi, readSchemaDocument } from "./readers/json-schema";
import type { ConvertedContract } from "./model";
import { readPostgresDeclarations } from "./readers/postgres-ddl";
import { convertBangumiArchive, convertBangumiVocabulary } from "./readers/bangumi";

import { readProviderAcquisition } from "./acquisition";
export { providerArtifacts, fetchProviderSchemas } from "./acquisition";

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
export async function convertProviderSchemas(
	source = "all",
	acquisition?: Awaited<ReturnType<typeof readProviderAcquisition>>,
): Promise<ConvertedContract[]> {
	z.enum(["all", "bangumi", "musicbrainz", "vndb", "openlibrary"]).parse(source);
	const captured = acquisition ?? (await readProviderAcquisition(source));
	const inputs = captured.inputs.filter(
		(input) => source === "all" || input.artifact.source === source,
	);
	if (!inputs.length || (source === "all" && captured.receipt.scope !== "all"))
		throw new Error("Captured acquisition does not cover the requested providers");
	const artifacts = inputs.map((input) => input.artifact);
	const result: ConvertedContract[] = [];
	const texts = new Map(inputs.map((input) => [input.artifact.file, input.text]));
	for (const entry of artifacts) {
		const text = texts.get(entry.file);
		if (text === undefined) continue;
		const input = {
			source: entry.source,
			origin: entry.url,
			version: digest(Buffer.from(text)),
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
