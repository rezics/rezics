import { digest, schemaId, stableJson } from "@rezics/schema/identity";
import type { ConvertedContract, ConvertedField } from "../model";
import { readSchemaDocument } from "./json-schema";

/** @alpha Bangumi role/platform/template vocabularies expose every declaration rather than one opaque document wrapper. */
export function convertBangumiVocabulary(input: {
	file: string;
	text: string;
	origin: string;
	version: string;
}): ConvertedContract {
	const parsed = readSchemaDocument(input.text),
		fields: ConvertedField[] = [];
	const walk = (value: unknown, path: string, depth: number) => {
		if (depth > 64 || fields.length >= 100_000)
			throw new RangeError("Vocabulary declaration budget exceeded");
		const shape = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
		const stored =
			typeof value === "bigint" ? { kind: "integer", lexical: value.toString() } : value;
		fields.push({
			id: schemaId("schema-field", "bangumi", input.file, path),
			path,
			shape,
			required: "unspecified",
			cardinality: Array.isArray(value) ? "many" : "one",
			nullability: value === null ? "nullable" : "non-null",
			references: [],
			keywords: shape === "object" || shape === "array" ? [] : [{ key: "value", value: stored }],
		});
		if (Array.isArray(value))
			value.forEach((item, index) => walk(item, `${path}/${index}`, depth + 1));
		else if (value !== null && typeof value === "object")
			for (const [key, item] of Object.entries(value))
				walk(item, `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, depth + 1);
	};
	walk(parsed.document, "#", 0);
	fields[0]!.keywords.push({ key: "sourceSyntax", value: parsed.syntax });
	const hash = digest(stableJson(fields));
	return {
		id: schemaId("schema-contract", "bangumi", input.file, input.version, hash),
		source: "bangumi",
		name: input.file,
		version: input.version,
		origin: input.origin,
		dialect: "bangumi-vocabulary",
		digest: hash,
		fields,
	};
}

/** @alpha Archive field declarations retain their documented type/meaning even when no machine schema is published. */
export function convertBangumiArchive(input: {
	file: string;
	text: string;
	origin: string;
	version: string;
}): ConvertedContract[] {
	const groups = new Map<string, ConvertedField[]>();
	let name: string | undefined;
	for (const [lineNumber, line] of input.text.split(/\r?\n/).entries()) {
		const heading = /^- .+?[（(]([A-Za-z-]+)[）)]/u.exec(line)?.[1];
		if (heading) name = heading.toLowerCase();
		const field = /^\s*\|\s*`([^`]+)`\s*\|/u.exec(line)?.[1];
		if (!name || !field) continue;
		const fields = groups.get(name) ?? [];
		fields.push({
			id: schemaId("schema-field", "bangumi", name, field),
			path: field,
			shape: "documented-value",
			required: "unspecified",
			cardinality: "unspecified",
			nullability: "unspecified",
			references: [],
			keywords: [
				{
					key: "archive:declaration",
					value: {
						line: lineNumber + 1,
						columns: line
							.split("|")
							.slice(1, -1)
							.map((value) => value.trim()),
					},
				},
			],
		});
		groups.set(name, fields);
	}
	if (!groups.size)
		throw new TypeError("Archive documentation has no recognized field declarations");
	return [...groups].map(([name, fields]) => {
		const hash = digest(stableJson(fields));
		return {
			id: schemaId("schema-contract", "bangumi", name, input.version, hash),
			source: "bangumi",
			name: `archive:${name}`,
			version: input.version,
			origin: input.origin,
			dialect: "bangumi-archive",
			digest: hash,
			fields,
		};
	});
}
