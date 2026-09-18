import { createHash } from "node:crypto";
import { z } from "zod";

export const CatalogSourceValues = ["bangumi", "vndb", "musicbrainz", "openlibrary"] as const;

export const SourceContractFieldSchema = z.strictObject({
	source: z.enum(CatalogSourceValues),
	contract: z.string().min(1),
	path: z.string().min(1),
	shape: z.string().min(1),
	reference: z.string().nullable(),
	repeated: z.boolean().nullable(),
	nullable: z.boolean().nullable(),
});
export type SourceContractField = z.infer<typeof SourceContractFieldSchema>;

const recordSchema = z.record(z.string(), z.unknown());
export function contractRecord(value: unknown): Record<string, unknown> {
	return recordSchema.parse(value);
}

/** @alpha Normalize unordered VNDB external links and JSON keys without pinning the live schema. */
export function normalizeProviderArtifact(format: string, bytes: Uint8Array): Buffer {
	if (format !== "vndb") return Buffer.from(bytes);
	const document = contractRecord(
		JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
	);
	if (Object.keys(contractRecord(document.api_fields)).length === 0)
		throw new TypeError("VNDB schema has no API fields");
	contractRecord(document.enums);
	const extlinks = contractRecord(document.extlinks);
	const sortedLinks = Object.fromEntries(
		Object.entries(extlinks).map(([endpoint, definitions]) => {
			const entries = z.array(recordSchema).parse(definitions);
			const names = entries.map((entry) => z.string().parse(entry.name));
			if (new Set(names).size !== names.length)
				throw new TypeError(`Duplicate VNDB external link name: ${endpoint}`);
			return [
				endpoint,
				[...entries].sort((left, right) =>
					String(left.name) < String(right.name)
						? -1
						: String(left.name) > String(right.name)
							? 1
							: 0,
				),
			];
		}),
	);
	const canonicalize = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(canonicalize);
		if (value !== null && typeof value === "object")
			return Object.fromEntries(
				Object.entries(contractRecord(value))
					.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
					.map(([key, child]) => [key, canonicalize(child)]),
			);
		return value;
	};
	return Buffer.from(JSON.stringify(canonicalize({ ...document, extlinks: sortedLinks })) + "\n");
}

/** Hash semantic JSON independently of upstream object-key serialization order. */
export function canonicalContractHash(value: unknown): string {
	const canonicalize = (input: unknown): unknown => {
		if (Array.isArray(input)) return input.map(canonicalize);
		if (input !== null && typeof input === "object")
			return Object.fromEntries(
				Object.entries(contractRecord(input))
					.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
					.map(([key, child]) => [key, canonicalize(child)]),
			);
		return input;
	};
	return createHash("sha256")
		.update(JSON.stringify(canonicalize(value)))
		.digest("hex");
}

/** Includes inherited links once, without recursively expanding cyclic VN graphs. */
export function inventoryVndb(value: unknown): SourceContractField[] {
	const fields = contractRecord(contractRecord(value).api_fields);
	const result: SourceContractField[] = [];
	const walk = (contract: string, node: Record<string, unknown>, prefix: string, depth: number) => {
		if (depth > 32) throw new Error("VNDB field nesting exceeds the reviewed contract bound");
		for (const [name, shape] of Object.entries(node)) {
			if (name === "_inherit") continue;
			const path = prefix ? `${prefix}.${name}` : name;
			const object = shape === null ? null : contractRecord(shape);
			const inherited = object?._inherit;
			if (inherited !== undefined && (typeof inherited !== "string" || !fields[inherited]))
				throw new Error(`Unknown VNDB inherited endpoint at ${contract}.${path}`);
			result.push({
				source: "vndb",
				contract,
				path,
				shape: object ? "selectable_object" : "documented_value",
				reference: typeof inherited === "string" ? inherited : null,
				repeated: null,
				nullable: null,
			});
			if (object) walk(contract, object, path, depth + 1);
		}
	};
	for (const [contract, shape] of Object.entries(fields))
		walk(contract, contractRecord(shape), "", 0);
	return result;
}

/** Field inventory preserves union branches and references, including inconsistent upstream shapes. */
export function inventoryJsonSchema(
	source: "bangumi",
	contract: string,
	value: unknown,
): SourceContractField[] {
	const result: SourceContractField[] = [];
	const walk = (schema: unknown, path: string, depth: number, repeated: boolean) => {
		if (depth > 48) throw new Error(`Schema nesting exceeds bound: ${contract}`);
		const node = contractRecord(schema);
		const shape = node.type;
		const reference = typeof node.$ref === "string" ? node.$ref : null;
		const types = Array.isArray(shape) ? z.array(z.string()).parse(shape) : null;
		result.push({
			source,
			contract,
			path: path || "$",
			shape:
				typeof shape === "string"
					? shape
					: types
						? types.join("|")
						: reference
							? "reference"
							: "composition",
			reference,
			repeated,
			nullable: node.nullable === true || types?.includes("null") === true,
		});
		if (node.properties !== undefined)
			for (const [key, child] of Object.entries(contractRecord(node.properties)))
				walk(child, path ? `${path}.${key}` : key, depth + 1, repeated);
		if (node.items !== undefined) walk(node.items, `${path}[]`, depth + 1, true);
		for (const branch of ["allOf", "anyOf", "oneOf"])
			if (node[branch] !== undefined)
				z.array(z.unknown())
					.parse(node[branch])
					.forEach((child, index) =>
						walk(child, `${path}@${branch}:${index}`, depth + 1, repeated),
					);
		if (node.additionalProperties !== undefined && typeof node.additionalProperties !== "boolean")
			walk(node.additionalProperties, `${path}.*`, depth + 1, repeated);
	};
	walk(value, "", 0, false);
	return result;
}

/** Open Library's `unique` means one value per record, not a global unique index. */
export function inventoryOpenLibrary(value: unknown): SourceContractField[] {
	const type = contractRecord(value);
	const contract = z.string().parse(type.key);
	return z
		.array(z.unknown())
		.parse(type.properties ?? [])
		.map((property) => {
			const record = contractRecord(property);
			const expectedType = z.string().parse(contractRecord(record.expected_type).key);
			return {
				source: "openlibrary",
				contract,
				path: z.string().parse(record.name),
				shape: expectedType,
				reference: expectedType,
				repeated: !z.boolean().parse(record.unique),
				nullable: true,
			};
		});
}

/** Split SQL at top-level commas; quoted values and comments cannot create columns. */
export function splitSqlColumns(source: string, separator: "," | ";" = ","): string[] {
	const columns: string[] = [];
	let buffer = "";
	let depth = 0;
	let quote: "'" | '"' | null = null;
	let blockDepth = 0;
	let lineComment = false;
	for (let i = 0; i < source.length; i++) {
		const ch = source[i];
		const next = source[i + 1];
		if (ch === undefined) throw new Error("Missing SQL character");
		if (lineComment) {
			if (ch === "\n") {
				lineComment = false;
				buffer += " ";
			}
			continue;
		}
		if (blockDepth > 0) {
			if (ch === "/" && next === "*") {
				blockDepth++;
				i++;
			} else if (ch === "*" && next === "/") {
				blockDepth--;
				i++;
			}
			continue;
		}
		if (quote) {
			buffer += ch;
			if (ch === quote) {
				if (next === quote) {
					buffer += next;
					i++;
				} else quote = null;
			}
			continue;
		}
		if (ch === "-" && next === "-") {
			lineComment = true;
			i++;
			buffer += " ";
			continue;
		}
		if (ch === "/" && next === "*") {
			blockDepth = 1;
			i++;
			buffer += " ";
			continue;
		}
		if (ch === "'" || ch === '"') quote = ch;
		if (ch === "(") depth++;
		if (ch === ")" && --depth < 0) throw new Error("Unbalanced SQL column expression");
		if (ch === separator && depth === 0) {
			columns.push(buffer.trim());
			buffer = "";
		} else buffer += ch;
	}
	if (quote || blockDepth || depth) throw new Error("Unterminated SQL column expression");
	if (buffer.trim()) columns.push(buffer.trim());
	return columns;
}

/** Inspects the pinned CREATE TABLE artifact without executing any upstream SQL. */
export function inventoryMusicBrainz(source: string): SourceContractField[] {
	const fields: SourceContractField[] = [];
	const tableStarts = [...source.matchAll(/^CREATE TABLE\s+([a-z_][a-z_0-9]*)\b/gmu)];
	const tables = splitSqlColumns(source, ";").filter((statement) =>
		/^CREATE TABLE\b/u.test(statement),
	);
	if (tableStarts.length === 0 || tableStarts.length !== tables.length)
		throw new Error("Unrecognized MusicBrainz table syntax; inventory would be incomplete");
	for (const statement of tables) {
		const partition =
			/^CREATE TABLE\s+([a-z_][a-z_0-9]*)\s+PARTITION OF\s+([a-z_][a-z_0-9]*)\s+FOR VALUES\b/u.exec(
				statement,
			);
		if (partition) {
			fields.push({
				source: "musicbrainz",
				contract: z.string().parse(partition[1]),
				path: "$partition",
				shape: "partition",
				reference: z.string().parse(partition[2]),
				repeated: false,
				nullable: false,
			});
			continue;
		}
		const withoutPartition = statement.replace(
			/\s+PARTITION BY\s+(?:LIST|RANGE|HASH)\s*\([^()]*\)\s*$/u,
			"",
		);
		const table = /^CREATE TABLE\s+([a-z_][a-z_0-9]*)\s*\((.*)\)$/su.exec(withoutPartition);
		const name = table?.[1];
		const body = table?.[2];
		if (!name || !body) throw new Error("Missing MusicBrainz table body");
		for (const column of splitSqlColumns(body)) {
			if (/^(?:CHECK|CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|EXCLUDE)\b/iu.test(column)) continue;
			const parsed = /^([a-z_][a-z_0-9]*)\s+(.+)$/isu.exec(column);
			const path = parsed?.[1];
			const definition = parsed?.[2];
			if (!path || !definition) throw new Error(`Unrecognized ${name} column: ${column}`);
			const shape = definition
				.split(/\s+(?:NOT\s+NULL|NULL|DEFAULT|CHECK|REFERENCES|PRIMARY|UNIQUE)\b/iu)[0]
				?.trim();
			if (!shape) throw new Error(`Missing ${name}.${path} type`);
			fields.push({
				source: "musicbrainz",
				contract: name,
				path,
				shape,
				reference: null,
				repeated: shape.includes("[]"),
				nullable: !/\bNOT\s+NULL\b/iu.test(definition),
			});
		}
	}
	return fields;
}

export function assertUniqueSourceFields(fields: readonly SourceContractField[]): void {
	const identities = new Set<string>();
	for (const field of fields) {
		SourceContractFieldSchema.parse(field);
		const key = JSON.stringify([field.source, field.contract, field.path]);
		if (identities.has(key)) throw new Error(`Duplicate source field: ${key}`);
		identities.add(key);
	}
}

export function applyMusicBrainzKeys(
	fields: readonly SourceContractField[],
	foreignKeys: string,
	primaryKeys: string,
): SourceContractField[] {
	const byKey = new Map(
		fields.map((field) => [JSON.stringify([field.source, field.contract, field.path]), field]),
	);
	const replace = (table: string, column: string, update: Partial<SourceContractField>) => {
		const key = JSON.stringify(["musicbrainz", table, column]);
		const field = byKey.get(key);
		if (!field)
			throw new Error(`MusicBrainz constraint has an unlisted column: ${table}.${column}`);
		byKey.set(key, { ...field, ...update });
	};
	for (const statement of splitSqlColumns(foreignKeys, ";")) {
		if (!/\bFOREIGN KEY\b/u.test(statement)) continue;
		const match =
			/ALTER TABLE\s+([a-z_0-9]+)\s+ADD CONSTRAINT\s+[a-z_0-9]+\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES\s+([a-z_0-9]+)\s*\(([^)]+)\)/u.exec(
				statement,
			);
		const [, table, columns, target, targetColumns] = match ?? [];
		if (!table || !columns || !target || !targetColumns)
			throw new Error("Unrecognized MusicBrainz FK declaration");
		const targets = targetColumns.split(",").map((column) => column.trim());
		const sourceColumns = columns.split(",").map((column) => column.trim());
		if (targets.length !== sourceColumns.length) throw new Error("MusicBrainz FK arity differs");
		for (const column of targets)
			if (!byKey.has(JSON.stringify(["musicbrainz", target, column])))
				throw new Error(`MusicBrainz constraint has an unlisted target: ${target}.${column}`);
		sourceColumns.forEach((column, i) =>
			replace(table, column, { reference: `${target}.${targets[i]}` }),
		);
	}
	for (const statement of splitSqlColumns(primaryKeys, ";")) {
		if (!/\bPRIMARY KEY\b/u.test(statement)) continue;
		const match =
			/ALTER TABLE\s+([a-z_0-9]+)\s+ADD CONSTRAINT\s+[a-z_0-9]+\s+PRIMARY KEY\s*\(([^)]+)\)/u.exec(
				statement,
			);
		const [, table, columns] = match ?? [];
		if (!table || !columns) throw new Error("Unrecognized MusicBrainz PK declaration");
		for (const column of columns.split(",")) replace(table, column.trim(), { nullable: false });
	}
	return [...byKey.values()];
}

/** Verify the entire pinned component graph, including references outside response schemas. */
export function assertSchemaReferencesComplete(documents: ReadonlyMap<string, unknown>): void {
	for (const [origin, document] of documents) {
		const visited = new Set<object>();
		const walk = (value: unknown) => {
			if (value === null || typeof value !== "object" || visited.has(value)) return;
			visited.add(value);
			if (Array.isArray(value)) {
				value.forEach(walk);
				return;
			}
			const object = contractRecord(value);
			if (typeof object.$ref === "string") {
				const reference = new URL(object.$ref, origin);
				const fragment = decodeURIComponent(reference.hash.slice(1));
				reference.hash = "";
				let target = documents.get(reference.href);
				if (target === undefined) throw new Error(`Unpinned schema reference: ${reference.href}`);
				if (fragment && !fragment.startsWith("/"))
					throw new Error("Unsupported schema reference anchor");
				for (const token of fragment ? fragment.slice(1).split("/") : []) {
					const key = token.replace(/~1/gu, "/").replace(/~0/gu, "~");
					target = Array.isArray(target) ? target[Number(key)] : contractRecord(target)[key];
					if (target === undefined) throw new Error(`Missing schema reference: ${object.$ref}`);
				}
			}
			Object.values(object).forEach(walk);
		};
		walk(document);
	}
}
