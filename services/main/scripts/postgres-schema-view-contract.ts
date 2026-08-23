import type { PostgreSqlSchemaView } from "../src/services/database/schema/postgres/manifest";

export type PostgreSqlViewCatalogRow = {
	readonly key: unknown;
	readonly relationKind: unknown;
	readonly relOptions: unknown;
	readonly columns: unknown;
	readonly definition: unknown;
};

export type PostgreSqlViewSnapshot = {
	readonly key: PostgreSqlSchemaView["name"];
	readonly relationKind: string;
	readonly relOptions: readonly string[];
	readonly columns: readonly {
		readonly name: string;
		readonly dataType: string;
	}[];
	readonly definition: string | null;
};

function readString(value: unknown, location: string): string {
	if (typeof value !== "string") throw new TypeError(`${location} must be a string`);
	return value;
}

function readCurrentViewName(value: unknown, location: string): PostgreSqlSchemaView["name"] {
	const name = readString(value, location);
	if (!name.startsWith("current_")) throw new TypeError(`${location} must start with current_`);
	return name as PostgreSqlSchemaView["name"];
}

function readStringArray(value: unknown, location: string): readonly string[] {
	if (!Array.isArray(value)) throw new TypeError(`${location} must be an array`);
	return value.map((entry, index) => readString(entry, `${location}[${String(index)}]`));
}

function readColumns(value: unknown, location: string): PostgreSqlViewSnapshot["columns"] {
	if (!Array.isArray(value)) throw new TypeError(`${location} must be an array`);
	return value.map((entry, index) => {
		const entryLocation = `${location}[${String(index)}]`;
		if (typeof entry !== "object" || entry === null)
			throw new TypeError(`${entryLocation} must be an object`);
		if (!("name" in entry) || !("dataType" in entry))
			throw new TypeError(`${entryLocation} must contain name and dataType`);
		return {
			name: readString(entry.name, `${entryLocation}.name`),
			dataType: readString(entry.dataType, `${entryLocation}.dataType`),
		};
	});
}

export function decodePostgreSqlViewSnapshots(
	rows: readonly PostgreSqlViewCatalogRow[],
): readonly PostgreSqlViewSnapshot[] {
	return rows.map((row, index) => {
		const key = readCurrentViewName(row.key, `view row ${String(index)}.key`);
		if (row.definition !== null && typeof row.definition !== "string")
			throw new TypeError(`PostgreSQL view ${key} definition must be a string or null`);
		return {
			key,
			relationKind: readString(row.relationKind, `PostgreSQL relation ${key} kind`),
			relOptions: readStringArray(row.relOptions, `PostgreSQL relation ${key} options`),
			columns: readColumns(row.columns, `PostgreSQL relation ${key} columns`),
			definition: row.definition,
		};
	});
}

function assertUniqueKeys(keys: readonly string[], kind: string): void {
	const seen = new Set<string>();
	for (const key of keys) {
		if (seen.has(key)) throw new Error(`Duplicate PostgreSQL ${kind} ${key}`);
		seen.add(key);
	}
}

function assertStringArraysEqual(
	actual: readonly string[],
	expected: readonly string[],
	message: string,
): void {
	if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index]))
		throw new Error(message);
}

function assertColumnSignaturesEqual(
	actual: PostgreSqlViewSnapshot["columns"],
	expected: PostgreSqlSchemaView["columns"],
	viewName: string,
): void {
	if (actual.length !== expected.length)
		throw new Error(`PostgreSQL view ${viewName} column signature diverges from its manifest`);
	for (const [index, expectedColumn] of expected.entries()) {
		const actualColumn = actual[index];
		if (
			actualColumn?.name !== expectedColumn.name ||
			actualColumn.dataType !== expectedColumn.dataType
		)
			throw new Error(`PostgreSQL view ${viewName} column signature diverges from its manifest`);
	}
}

export function assertPostgreSqlViewManifest(
	snapshots: readonly PostgreSqlViewSnapshot[],
	manifest: readonly PostgreSqlSchemaView[],
): void {
	assertUniqueKeys(
		manifest.map(({ name }) => name),
		"view manifest entry",
	);
	assertUniqueKeys(
		snapshots.map(({ key }) => key),
		"current relation",
	);

	const expectedByName = new Map(manifest.map((view) => [view.name, view] as const));
	const actualByName = new Map(snapshots.map((view) => [view.key, view] as const));
	for (const name of expectedByName.keys())
		if (!actualByName.has(name)) throw new Error(`Missing PostgreSQL view ${name}`);
	for (const name of actualByName.keys())
		if (!expectedByName.has(name))
			throw new Error(`Unexpected PostgreSQL current relation ${name}`);

	for (const [name, expected] of expectedByName) {
		const actual = actualByName.get(name);
		if (!actual) throw new Error(`Missing PostgreSQL view ${name}`);
		if (actual.relationKind !== "v")
			throw new Error(`PostgreSQL relation ${name} is not an ordinary view`);
		assertStringArraysEqual(
			actual.relOptions,
			expected.relOptions,
			`PostgreSQL view ${name} options diverge from its manifest`,
		);
		assertColumnSignaturesEqual(actual.columns, expected.columns, name);
		if (!actual.definition)
			throw new Error(`PostgreSQL view ${name} has no reconstructable definition`);
	}
}

export function assertPostgreSqlViewDefinitionsEqual(
	before: readonly PostgreSqlViewSnapshot[],
	after: readonly PostgreSqlViewSnapshot[],
): void {
	const afterByName = new Map(after.map((view) => [view.key, view.definition] as const));
	for (const { key, definition } of before)
		if (afterByName.get(key) !== definition)
			throw new Error(`Migration replay diverges from canonical PostgreSQL view ${key}`);
}

export function assertCanonicalPostgreSqlViewDeclarations(
	schemaDefinitions: readonly string[],
	manifest: readonly PostgreSqlSchemaView[],
): void {
	const declarationPattern =
		/\bcreate\s+or\s+replace\s+view\s+(?:"?public"?\s*\.\s*)?"?(current_[a-z0-9_]+)"?/giu;
	const declarationNames = schemaDefinitions.flatMap((definition) =>
		[...definition.matchAll(declarationPattern)].map((match) =>
			readCurrentViewName(match[1], "canonical PostgreSQL view declaration"),
		),
	);
	assertUniqueKeys(declarationNames, "canonical view declaration");
	const declared = new Set(declarationNames);
	const expected = new Set(manifest.map(({ name }) => name));
	for (const name of expected)
		if (!declared.has(name))
			throw new Error(`Missing canonical PostgreSQL view declaration ${name}`);
	for (const name of declared)
		if (!expected.has(name))
			throw new Error(`Unexpected canonical PostgreSQL current view declaration ${name}`);
}
