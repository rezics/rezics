export type PostgreSqlDefinition = {
	readonly key: string;
};

export type PostgreSqlTriggerIdentity = {
	readonly table: string;
	readonly name: string;
};

type PostgreSqlTriggerTiming = "AFTER" | "BEFORE" | "INSTEAD OF";
type PostgreSqlTriggerEvent = "DELETE" | "INSERT" | "TRUNCATE" | "UPDATE";
type PostgreSqlTriggerLevel = "ROW" | "STATEMENT";

export type PostgreSqlTriggerContract = PostgreSqlTriggerIdentity & {
	readonly timing: PostgreSqlTriggerTiming;
	readonly events: readonly PostgreSqlTriggerEvent[];
	readonly level: PostgreSqlTriggerLevel;
	readonly functionName: string;
};

type CanonicalPostgreSqlTriggerDeclaration = PostgreSqlTriggerContract & {
	readonly key: string;
};

function triggerKey({ table, name }: PostgreSqlTriggerIdentity): string {
	return `${table}.${name}`;
}

function assertUniqueKeys(keys: readonly string[], kind: string): void {
	const seen = new Set<string>();
	for (const key of keys) {
		if (seen.has(key)) throw new Error(`Duplicate PostgreSQL ${kind} ${key}`);
		seen.add(key);
	}
}

function assertExactKeys(
	actualKeys: readonly string[],
	expectedKeys: readonly string[],
	kind: string,
): void {
	assertUniqueKeys(actualKeys, kind);
	assertUniqueKeys(expectedKeys, `${kind} manifest entry`);
	const actual = new Set(actualKeys);
	const expected = new Set(expectedKeys);
	for (const key of expected)
		if (!actual.has(key)) throw new Error(`Missing PostgreSQL ${kind} ${key}`);
	for (const key of actual)
		if (!expected.has(key)) throw new Error(`Unexpected PostgreSQL ${kind} ${key}`);
}

export function assertPostgreSqlDefinitionsComplete(
	definitions: readonly PostgreSqlDefinition[],
	expectedKeys: readonly string[],
	kind: string,
): void {
	assertExactKeys(
		definitions.map(({ key }) => key),
		expectedKeys,
		kind,
	);
}

export function assertCanonicalPostgreSqlSchemaFiles(
	actualFileNames: readonly string[],
	expectedFileNames: readonly string[],
): void {
	assertExactKeys(actualFileNames, expectedFileNames, "canonical schema file");
}

function canonicalFunctionNames(schemaDefinitions: readonly string[]): readonly string[] {
	const declarationPattern =
		/^\s*create\s+(?:or\s+replace\s+)?function\s+(?:"?public"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?\s*\(/gimu;
	return schemaDefinitions.flatMap((definition) =>
		[...definition.matchAll(declarationPattern)].map((match) => {
			const name = match[1];
			if (!name) throw new Error("Canonical PostgreSQL function declaration has no name");
			return name;
		}),
	);
}

function readTriggerTiming(value: string | undefined, key: string): PostgreSqlTriggerTiming {
	switch (value?.replace(/\s+/gu, " ").toUpperCase()) {
		case "AFTER":
			return "AFTER";
		case "BEFORE":
			return "BEFORE";
		case "INSTEAD OF":
			return "INSTEAD OF";
		default:
			throw new Error(`Canonical PostgreSQL trigger ${key} has no supported timing`);
	}
}

function readTriggerEvent(value: string, key: string): PostgreSqlTriggerEvent {
	switch (value.toUpperCase()) {
		case "DELETE":
			return "DELETE";
		case "INSERT":
			return "INSERT";
		case "TRUNCATE":
			return "TRUNCATE";
		case "UPDATE":
			return "UPDATE";
		default:
			throw new Error(`Canonical PostgreSQL trigger ${key} has unsupported event ${value}`);
	}
}

function readTriggerLevel(value: string | undefined, key: string): PostgreSqlTriggerLevel {
	switch (value?.toUpperCase()) {
		case "ROW":
			return "ROW";
		case "STATEMENT":
			return "STATEMENT";
		default:
			throw new Error(`Canonical PostgreSQL trigger ${key} has no supported level`);
	}
}

function canonicalTriggerDeclarations(
	schemaDefinitions: readonly string[],
): readonly CanonicalPostgreSqlTriggerDeclaration[] {
	const declarationPattern =
		/^\s*create\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+"?([a-z_][a-z0-9_]*)"?\b([\s\S]*?)\bon\s+(?:"?public"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?\b([\s\S]*?)\bexecute\s+function\s+(?:"?public"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?\s*\([^;]*?\)\s*;/gimu;
	return schemaDefinitions.flatMap((definition) =>
		[...definition.matchAll(declarationPattern)].map((match) => {
			const name = match[1];
			const beforeOn = match[2];
			const table = match[3];
			const afterOn = match[4];
			const functionName = match[5];
			if (!name || !beforeOn || !table || !afterOn || !functionName)
				throw new Error("Canonical PostgreSQL trigger declaration has no identity");
			const key = `${table}.${name}`;
			const timing = readTriggerTiming(
				beforeOn.match(/\b(after|before|instead\s+of)\b/iu)?.[1],
				key,
			);
			const events = [...beforeOn.matchAll(/\b(delete|insert|truncate|update)\b/giu)].map((event) =>
				readTriggerEvent(event[1] ?? "", key),
			);
			if (events.length === 0)
				throw new Error(`Canonical PostgreSQL trigger ${key} has no supported event`);
			assertUniqueKeys(events, `trigger ${key} event`);
			const level = readTriggerLevel(afterOn.match(/\bfor\s+each\s+(row|statement)\b/iu)?.[1], key);
			return { key, table, name, timing, events, level, functionName };
		}),
	);
}

function sortedEvents(events: readonly PostgreSqlTriggerEvent[], key: string): readonly string[] {
	assertUniqueKeys(events, `trigger contract ${key} event`);
	return [...events].sort();
}

function assertTriggerContracts(
	declarations: readonly CanonicalPostgreSqlTriggerDeclaration[],
	expectedContracts: readonly PostgreSqlTriggerContract[],
): void {
	const expectedKeys = expectedContracts.map(triggerKey);
	assertUniqueKeys(expectedKeys, "trigger contract manifest entry");
	const declarationByKey = new Map(
		declarations.map((declaration) => [declaration.key, declaration]),
	);
	for (const expected of expectedContracts) {
		const key = triggerKey(expected);
		const actual = declarationByKey.get(key);
		if (!actual) throw new Error(`Missing PostgreSQL canonical trigger contract source ${key}`);
		if (
			actual.timing !== expected.timing ||
			actual.level !== expected.level ||
			actual.functionName !== expected.functionName ||
			JSON.stringify(sortedEvents(actual.events, key)) !==
				JSON.stringify(sortedEvents(expected.events, key))
		)
			throw new Error(`Canonical PostgreSQL trigger contract diverges for ${key}`);
	}
}

export function assertCanonicalPostgreSqlObjectManifest(
	schemaDefinitions: readonly string[],
	expectedFunctionNames: readonly string[],
	expectedTriggers: readonly PostgreSqlTriggerIdentity[],
	expectedTriggerContracts: readonly PostgreSqlTriggerContract[],
): void {
	assertExactKeys(
		canonicalFunctionNames(schemaDefinitions),
		expectedFunctionNames,
		"canonical function declaration",
	);
	const triggerDeclarations = canonicalTriggerDeclarations(schemaDefinitions);
	assertExactKeys(
		triggerDeclarations.map(({ key }) => key),
		expectedTriggers.map(triggerKey),
		"canonical trigger declaration",
	);
	assertTriggerContracts(triggerDeclarations, expectedTriggerContracts);
}
