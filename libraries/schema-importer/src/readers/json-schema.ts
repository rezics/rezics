import { isAlias, isMap, isScalar, isSeq, parseDocument } from "yaml";
import { digest, schemaId, stableJson } from "@rezics/schema/identity";
import type { ConvertedContract, ConvertedField } from "../model";

/** @alpha A syntax tree retains numeric lexical values, aliases and every extension keyword. */
export function readSchemaDocument(text: string) {
	const document = parseDocument(text, { intAsBigInt: true, uniqueKeys: true });
	if (document.errors.length)
		throw new TypeError(document.errors.map((error) => error.message).join("; "));
	const syntax = (node: unknown): unknown => {
		if (isAlias(node)) return { kind: "alias", name: node.source };
		if (isMap(node))
			return {
				kind: "object",
				members: node.items.map((pair) => ({ key: syntax(pair.key), value: syntax(pair.value) })),
			};
		if (isSeq(node)) return { kind: "array", items: node.items.map(syntax) };
		if (isScalar(node))
			return {
				kind:
					typeof node.value === "bigint" || typeof node.value === "number"
						? "number"
						: node.value === null
							? "null"
							: typeof node.value,
				value:
					typeof node.value === "bigint" || typeof node.value === "number"
						? node.source
						: String(node.value),
			};
		return { kind: "null", value: "null" };
	};
	return { document: document.toJS({ maxAliasCount: 10_000 }), syntax: syntax(document.contents) };
}
const record = (value: unknown): Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
const pointer = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");
function portable(value: unknown, seen = new Set<object>(), depth = 0): unknown {
	if (depth > 128) throw new RangeError("Schema syntax nesting budget exceeded");
	if (typeof value === "bigint") return { kind: "integer", lexical: value.toString() };
	if (value === null || typeof value !== "object") return value;
	if (seen.has(value)) throw new TypeError("Cyclic YAML expansion requires an explicit reference");
	seen.add(value);
	const result = Array.isArray(value)
		? value.map((child) => portable(child, seen, depth + 1))
		: Object.fromEntries(
				Object.entries(value).map(([key, child]) => [key, portable(child, seen, depth + 1)]),
			);
	seen.delete(value);
	return result;
}
function syntaxAt(root: unknown, path: string): unknown {
	let current = record(root);
	for (const token of path.replace(/^#\/?/, "").split("/").filter(Boolean)) {
		const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
		if (current.kind === "object")
			current = record(
				(current.members as { key: { value: string }; value: unknown }[]).find(
					(member) => member.key.value === key,
				)?.value,
			);
		else if (current.kind === "array") current = record((current.items as unknown[])[Number(key)]);
		else return undefined;
	}
	return Object.keys(current).length ? current : undefined;
}

/** @alpha Convert JSON Schema/OpenAPI definitions without flattening composition or following network references. */
export function convertJsonSchema(input: {
	source: string;
	name: string;
	version: string;
	origin: string;
	schema: unknown;
	syntax?: unknown;
}): ConvertedContract {
	const fields: ConvertedField[] = [];
	const seen = new Set<object>();
	const walk = (
		value: unknown,
		path: string,
		base: string,
		required: "yes" | "no" | "unspecified",
		depth: number,
	) => {
		if (depth > 128 || fields.length >= 100_000)
			throw new RangeError("Schema declaration budget exceeded");
		const node = record(value);
		if (typeof value === "object" && value !== null) {
			if (seen.has(value))
				throw new TypeError("Cyclic YAML expansion requires an explicit reference");
			seen.add(value);
		}
		const localBase = typeof node.$id === "string" ? new URL(node.$id, base).href : base;
		const types = Array.isArray(node.type)
			? node.type
			: typeof node.type === "string"
				? [node.type]
				: [];
		const references = ["$ref", "$dynamicRef", "$recursiveRef"].flatMap((key) =>
			typeof node[key] === "string"
				? [{ kind: key, value: node[key], target: new URL(node[key], localBase).href }]
				: [],
		);
		fields.push({
			id: schemaId("schema-field", input.source, input.name, path),
			path,
			shape:
				value === true
					? "any"
					: value === false
						? "never"
						: types.length
							? types.join("|")
							: references.length
								? "reference"
								: "composition",
			required,
			cardinality: types.includes("array") ? "many" : types.length ? "one" : "unspecified",
			nullability:
				types.includes("null") || node.nullable === true
					? "nullable"
					: types.length || node.nullable === false
						? "non-null"
						: "unspecified",
			references,
			keywords: Object.entries(node).map(([key, value]) => ({
				key,
				value: syntaxAt(input.syntax, `${path}/${pointer(key)}`) ?? {
					kind: "decoded",
					value: portable(value),
				},
			})),
		});
		const requiredKeys = Array.isArray(node.required) ? node.required : [];
		for (const key of [
			"properties",
			"patternProperties",
			"$defs",
			"definitions",
			"dependentSchemas",
		])
			for (const [name, child] of Object.entries(record(node[key])))
				walk(
					child,
					`${path}/${key}/${pointer(name)}`,
					localBase,
					key === "properties" ? (requiredKeys.includes(name) ? "yes" : "no") : "unspecified",
					depth + 1,
				);
		for (const key of [
			"items",
			"additionalItems",
			"additionalProperties",
			"unevaluatedItems",
			"unevaluatedProperties",
			"propertyNames",
			"contains",
			"if",
			"then",
			"else",
			"not",
			"contentSchema",
		])
			if (node[key] !== undefined) {
				const children = Array.isArray(node[key]) ? node[key] : [node[key]];
				children.forEach((child, i) =>
					walk(
						child,
						`${path}/${key}${Array.isArray(node[key]) ? `/${i}` : ""}`,
						localBase,
						"unspecified",
						depth + 1,
					),
				);
			}
		for (const key of ["allOf", "anyOf", "oneOf", "prefixItems"])
			if (Array.isArray(node[key]))
				node[key].forEach((child, i) =>
					walk(child, `${path}/${key}/${i}`, localBase, "unspecified", depth + 1),
				);
		if (value !== null && typeof value === "object") seen.delete(value);
	};
	walk(input.schema, "#", input.origin, "unspecified", 0);
	// The complete syntax is retained as a structured keyword, including precise YAML/JSON numeric spelling.
	if (input.syntax !== undefined)
		fields[0]!.keywords.push({ key: "rezics:sourceSyntax", value: input.syntax });
	const hash = digest(stableJson(portable({ schema: input.schema, syntax: input.syntax ?? null })));
	return {
		id: schemaId("schema-contract", input.source, input.name, input.version, hash),
		source: input.source,
		name: input.name,
		version: input.version,
		origin: input.origin,
		dialect: String(record(input.schema).$schema ?? "json-schema"),
		digest: hash,
		fields,
	};
}

/** @alpha Each OpenAPI component remains a separate contract; shared references keep their document scope. */
export function convertOpenApi(input: {
	source: string;
	version: string;
	origin: string;
	text: string;
}): ConvertedContract[] {
	const parsed = readSchemaDocument(input.text),
		doc = record(parsed.document);
	const components = record(record(doc.components).schemas);
	const schemas = Object.keys(components).length ? components : record(doc.definitions);
	const componentPrefix = Object.keys(components).length
		? "#/components/schemas/"
		: "#/definitions/";
	const output = [
		convertJsonSchema({ ...input, name: "openapi-document", schema: doc, syntax: parsed.syntax }),
		...Object.entries(schemas).map(([name, schema]) =>
			convertJsonSchema({
				...input,
				name,
				schema,
				syntax: syntaxAt(parsed.syntax, componentPrefix + pointer(name)),
			}),
		),
	];
	const walk = (value: unknown, path: string, depth: number) => {
		if (depth > 128) throw new RangeError("OpenAPI nesting budget exceeded");
		if (path.startsWith("#/components/schemas") || path.startsWith("#/definitions")) return;
		if (Array.isArray(value)) {
			value.forEach((child, i) => walk(child, `${path}/${i}`, depth + 1));
			return;
		}
		for (const [key, child] of Object.entries(record(value))) {
			const location = `${path}/${pointer(key)}`;
			if (key === "schema")
				output.push(
					convertJsonSchema({
						...input,
						name: location,
						schema: child,
						syntax: syntaxAt(parsed.syntax, location),
					}),
				);
			else walk(child, location, depth + 1);
		}
	};
	walk(doc, "#", 0);
	return output;
}
