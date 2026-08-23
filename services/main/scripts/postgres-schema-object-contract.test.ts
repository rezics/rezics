import { readdir, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
	PostgreSqlSchemaFileNames,
	PostgreSqlSchemaFunctionNames,
	PostgreSqlSchemaTriggerContracts,
	PostgreSqlSchemaTriggers,
} from "../src/services/database/schema/postgres/manifest";
import {
	assertCanonicalPostgreSqlObjectManifest,
	assertCanonicalPostgreSqlSchemaFiles,
	assertPostgreSqlDefinitionsComplete,
} from "./postgres-schema-object-contract";

const CanonicalSchemaDirectory = new URL(
	"../src/services/database/schema/postgres/",
	import.meta.url,
);

const ExampleTriggerContract = {
	table: "example",
	name: "example_guard",
	timing: "AFTER",
	events: ["UPDATE"],
	level: "ROW",
	functionName: "guard_example",
} as const;

describe("canonical PostgreSQL object manifest", () => {
	it("owns every top-level SQL file, function, and trigger declaration", async () => {
		const actualFileNames = (await readdir(CanonicalSchemaDirectory, { withFileTypes: true }))
			.filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
			.map(({ name }) => name);
		expect(() =>
			assertCanonicalPostgreSqlSchemaFiles(actualFileNames, PostgreSqlSchemaFileNames),
		).not.toThrow();

		const definitions = await Promise.all(
			PostgreSqlSchemaFileNames.map((fileName) =>
				readFile(new URL(fileName, CanonicalSchemaDirectory), "utf8"),
			),
		);
		expect(() =>
			assertCanonicalPostgreSqlObjectManifest(
				definitions,
				PostgreSqlSchemaFunctionNames,
				PostgreSqlSchemaTriggers,
				PostgreSqlSchemaTriggerContracts,
			),
		).not.toThrow();
	});

	it("rejects missing files and duplicate catalog identities", () => {
		expect(() => assertCanonicalPostgreSqlSchemaFiles([], ["owned.sql"])).toThrow(/Missing/);
		expect(() =>
			assertPostgreSqlDefinitionsComplete(
				[{ key: "owned" }, { key: "owned" }],
				["owned"],
				"function",
			),
		).toThrow(/Duplicate PostgreSQL function owned/);
	});

	it("rejects unmanifested helpers and overloaded canonical names", () => {
		const helper =
			"CREATE OR REPLACE FUNCTION public.helper(uuid) RETURNS void LANGUAGE sql AS 'SELECT';";
		const overload =
			"CREATE OR REPLACE FUNCTION public.helper(text) RETURNS void LANGUAGE sql AS 'SELECT';";
		expect(() => assertCanonicalPostgreSqlObjectManifest([helper], [], [], [])).toThrow(
			/Unexpected PostgreSQL canonical function declaration helper/,
		);
		expect(() =>
			assertCanonicalPostgreSqlObjectManifest([`${helper}\n${overload}`], ["helper"], [], []),
		).toThrow(/Duplicate PostgreSQL canonical function declaration helper/);
	});

	it("recognizes constraint triggers and rejects manifest-only canonical entries", () => {
		const definition = `
CREATE OR REPLACE FUNCTION public.guard_example() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END';
CREATE CONSTRAINT TRIGGER example_guard
AFTER UPDATE ON public.example
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.guard_example();`;
		expect(() =>
			assertCanonicalPostgreSqlObjectManifest(
				[definition],
				["guard_example"],
				[{ table: "example", name: "example_guard" }],
				[ExampleTriggerContract],
			),
		).not.toThrow();
		expect(() =>
			assertCanonicalPostgreSqlObjectManifest(
				[definition],
				["guard_example"],
				[{ table: "example", name: "example_guard" }],
				[{ ...ExampleTriggerContract, level: "STATEMENT" }],
			),
		).toThrow(/Canonical PostgreSQL trigger contract diverges for example\.example_guard/);
		expect(() =>
			assertCanonicalPostgreSqlObjectManifest(
				[definition],
				["guard_example"],
				[
					{ table: "example", name: "example_guard" },
					{ table: "migration_owned", name: "existence_only_guard" },
				],
				[ExampleTriggerContract],
			),
		).toThrow(
			/Missing PostgreSQL canonical trigger declaration migration_owned\.existence_only_guard/,
		);
		expect(() =>
			assertCanonicalPostgreSqlObjectManifest(
				[definition],
				["guard_example"],
				[{ table: "other", name: "example_guard" }],
				[],
			),
		).toThrow(/Missing PostgreSQL canonical trigger declaration other\.example_guard/);
	});
});
