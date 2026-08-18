import { readFile } from "node:fs/promises";
import { Client } from "pg";

import {
	PostgreSqlSchemaFileNames,
	PostgreSqlSchemaFunctionNames,
	PostgreSqlSchemaTriggers,
} from "../src/services/database/schema/postgres/manifest";
import { adminDatabaseUrl } from "./admin-database";

type Definition = { readonly key: string; readonly definition: string };

function assertComplete(
	definitions: readonly Definition[],
	expectedKeys: ReadonlySet<string>,
	kind: string,
): void {
	const actualKeys = new Set(definitions.map(({ key }) => key));
	for (const key of expectedKeys)
		if (!actualKeys.has(key)) throw new Error(`Missing PostgreSQL ${kind} ${key}`);
	for (const key of actualKeys)
		if (!expectedKeys.has(key)) throw new Error(`Unexpected PostgreSQL ${kind} ${key}`);
}

async function readFunctionDefinitions(client: Client): Promise<readonly Definition[]> {
	const result = await client.query<Definition>(
		`select procedure.proname as key, pg_get_functiondef(procedure.oid) as definition
		 from pg_catalog.pg_proc procedure
		 join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
		 where namespace.nspname = 'public'
		   and procedure.proname = any($1::text[])
		 order by procedure.proname`,
		[[...PostgreSqlSchemaFunctionNames]],
	);
	return result.rows;
}

async function readTriggerDefinitions(client: Client): Promise<readonly Definition[]> {
	const names = PostgreSqlSchemaTriggers.map(({ name }) => name);
	const result = await client.query<Definition>(
		`select relation.relname || '.' || trigger.tgname as key,
		        pg_get_triggerdef(trigger.oid, true) as definition
		 from pg_catalog.pg_trigger trigger
		 join pg_catalog.pg_class relation on relation.oid = trigger.tgrelid
		 join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
		 where namespace.nspname = 'public'
		   and not trigger.tgisinternal
		   and trigger.tgname = any($1::text[])
		 order by relation.relname, trigger.tgname`,
		[names],
	);
	return result.rows;
}

function definitionMap(definitions: readonly Definition[]): ReadonlyMap<string, string> {
	return new Map(definitions.map(({ key, definition }) => [key, definition] as const));
}

function assertDefinitionsEqual(
	before: readonly Definition[],
	after: readonly Definition[],
	kind: string,
): void {
	const afterByKey = definitionMap(after);
	for (const { key, definition } of before)
		if (afterByKey.get(key) !== definition)
			throw new Error(`Migration replay diverges from canonical PostgreSQL ${kind} ${key}`);
}

async function main(): Promise<void> {
	const client = new Client({ connectionString: adminDatabaseUrl });
	await client.connect();
	try {
		const expectedFunctions = new Set<string>(PostgreSqlSchemaFunctionNames);
		const expectedTriggers = new Set(
			PostgreSqlSchemaTriggers.map(({ table, name }) => `${table}.${name}`),
		);
		const functionsBefore = await readFunctionDefinitions(client);
		const triggersBefore = await readTriggerDefinitions(client);
		assertComplete(functionsBefore, expectedFunctions, "function");
		assertComplete(triggersBefore, expectedTriggers, "trigger");

		const schemaDefinitions = await Promise.all(
			PostgreSqlSchemaFileNames.map((fileName) =>
				readFile(
					new URL(`../src/services/database/schema/postgres/${fileName}`, import.meta.url),
					"utf8",
				),
			),
		);
		await client.query("begin");
		try {
			for (const definition of schemaDefinitions) await client.query(definition);
			const functionsAfter = await readFunctionDefinitions(client);
			const triggersAfter = await readTriggerDefinitions(client);
			assertComplete(functionsAfter, expectedFunctions, "function");
			assertComplete(triggersAfter, expectedTriggers, "trigger");
			assertDefinitionsEqual(functionsBefore, functionsAfter, "function");
			assertDefinitionsEqual(triggersBefore, triggersAfter, "trigger");
		} finally {
			await client.query("rollback");
		}
		console.info("Canonical PostgreSQL functions and triggers match migration replay.");
	} finally {
		await client.end();
	}
}

await main();
