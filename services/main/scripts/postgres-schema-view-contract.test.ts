import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
	PostgreSqlSchemaFileNames,
	PostgreSqlSchemaViews,
} from "../src/services/database/schema/postgres/manifest";
import {
	assertCanonicalPostgreSqlViewDeclarations,
	assertPostgreSqlViewDefinitionsEqual,
	assertPostgreSqlViewManifest,
	decodePostgreSqlViewSnapshots,
	type PostgreSqlViewSnapshot,
} from "./postgres-schema-view-contract";

function snapshot(overrides: Partial<PostgreSqlViewSnapshot> = {}): PostgreSqlViewSnapshot {
	return {
		key: "current_example",
		relationKind: "v",
		relOptions: ["security_barrier=true"],
		columns: [{ name: "id", dataType: "uuid" }],
		definition: "SELECT id FROM example;",
		...overrides,
	};
}

const ExampleManifest = [
	{
		name: "current_example",
		relOptions: ["security_barrier=true"],
		columns: [{ name: "id", dataType: "uuid" }],
	},
] as const;

describe("canonical PostgreSQL view contract", () => {
	it("does not restore legacy mutable-projection current views", () => {
		expect(PostgreSqlSchemaViews).toEqual([]);
	});

	it("requires one canonical CREATE OR REPLACE declaration for every current view", async () => {
		const definitions = await Promise.all(
			PostgreSqlSchemaFileNames.map((fileName) =>
				readFile(
					new URL(`../src/services/database/schema/postgres/${fileName}`, import.meta.url),
					"utf8",
				),
			),
		);
		expect(() =>
			assertCanonicalPostgreSqlViewDeclarations(definitions, PostgreSqlSchemaViews),
		).not.toThrow();
	});

	it("rejects missing, unexpected, non-view, option, and column drift", () => {
		expect(() => assertPostgreSqlViewManifest([], ExampleManifest)).toThrow(/Missing/);
		expect(() =>
			assertPostgreSqlViewManifest(
				[snapshot(), snapshot({ key: "current_unexpected" })],
				ExampleManifest,
			),
		).toThrow(/Unexpected/);
		expect(() =>
			assertPostgreSqlViewManifest([snapshot({ relationKind: "m" })], ExampleManifest),
		).toThrow(/not an ordinary view/);
		expect(() =>
			assertPostgreSqlViewManifest([snapshot({ relOptions: [] })], ExampleManifest),
		).toThrow(/options diverge/);
		expect(() =>
			assertPostgreSqlViewManifest(
				[snapshot({ columns: [{ name: "id", dataType: "text" }] })],
				ExampleManifest,
			),
		).toThrow(/column signature diverges/);
	});

	it("rejects canonical definition drift after replay", () => {
		expect(() =>
			assertPostgreSqlViewDefinitionsEqual(
				[snapshot()],
				[snapshot({ definition: "SELECT other_id AS id FROM example;" })],
			),
		).toThrow(/diverges from canonical PostgreSQL view/);
	});

	it("fails closed on malformed PostgreSQL catalog values", () => {
		expect(() =>
			decodePostgreSqlViewSnapshots([
				{
					key: "current_example",
					relationKind: "v",
					relOptions: ["security_barrier=true"],
					columns: [{ name: "id", dataType: 1 }],
					definition: "SELECT id FROM example;",
				},
			]),
		).toThrow(/dataType must be a string/);
	});
});
