import { readdir, readFile } from "node:fs/promises";
import { Client } from "pg";

import {
	PostgreSqlSchemaFileNames,
	PostgreSqlSchemaFunctionNames,
	PostgreSqlSchemaTriggerContracts,
	PostgreSqlSchemaTriggers,
	PostgreSqlSchemaViews,
} from "../src/services/database/schema/postgres/manifest";
import { adminDatabaseUrl } from "./admin-database";
import {
	assertCanonicalPostgreSqlObjectManifest,
	assertCanonicalPostgreSqlSchemaFiles,
	assertPostgreSqlDefinitionsComplete,
} from "./postgres-schema-object-contract";
import {
	assertCanonicalPostgreSqlViewDeclarations,
	assertPostgreSqlViewDefinitionsEqual,
	assertPostgreSqlViewManifest,
	decodePostgreSqlViewSnapshots,
	type PostgreSqlViewCatalogRow,
	type PostgreSqlViewSnapshot,
} from "./postgres-schema-view-contract";

type Definition = { readonly key: string; readonly definition: string };

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

async function readViewDefinitions(client: Client): Promise<readonly PostgreSqlViewSnapshot[]> {
	const result = await client.query<PostgreSqlViewCatalogRow>(
		`select relation.relname as key,
		        relation.relkind as "relationKind",
		        coalesce(
		          (select array_agg(option order by option)
		           from unnest(relation.reloptions) option),
		          array[]::text[]
		        ) as "relOptions",
		        coalesce(signature.columns, '[]'::jsonb) as columns,
		        pg_catalog.pg_get_viewdef(relation.oid, false) as definition
		 from pg_catalog.pg_class relation
		 join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
		 left join lateral (
		   select jsonb_agg(
		            jsonb_build_object(
		              'name', attribute.attname,
		              'dataType', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
		            ) order by attribute.attnum
		          ) as columns
		   from pg_catalog.pg_attribute attribute
		   where attribute.attrelid = relation.oid
		     and attribute.attnum > 0
		     and not attribute.attisdropped
		 ) signature on true
		 where namespace.nspname = 'public'
		   and left(relation.relname, 8) = 'current_'
		 order by relation.relname`,
	);
	return decodePostgreSqlViewSnapshots(result.rows);
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
	const schemaDirectory = new URL("../src/services/database/schema/postgres/", import.meta.url);
	const actualFileNames = (await readdir(schemaDirectory, { withFileTypes: true }))
		.filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
		.map(({ name }) => name);
	assertCanonicalPostgreSqlSchemaFiles(actualFileNames, PostgreSqlSchemaFileNames);
	const schemaDefinitions = await Promise.all(
		PostgreSqlSchemaFileNames.map((fileName) =>
			readFile(new URL(fileName, schemaDirectory), "utf8"),
		),
	);
	assertCanonicalPostgreSqlObjectManifest(
		schemaDefinitions,
		PostgreSqlSchemaFunctionNames,
		PostgreSqlSchemaTriggers,
		PostgreSqlSchemaTriggerContracts,
	);

	const client = new Client({ connectionString: adminDatabaseUrl });
	await client.connect();
	try {
		const expectedTriggers = PostgreSqlSchemaTriggers.map(({ table, name }) => `${table}.${name}`);
		const functionsBefore = await readFunctionDefinitions(client);
		const triggersBefore = await readTriggerDefinitions(client);
		const viewsBefore = await readViewDefinitions(client);
		assertPostgreSqlDefinitionsComplete(functionsBefore, PostgreSqlSchemaFunctionNames, "function");
		assertPostgreSqlDefinitionsComplete(triggersBefore, expectedTriggers, "trigger");
		assertPostgreSqlViewManifest(viewsBefore, PostgreSqlSchemaViews);
		assertCanonicalPostgreSqlViewDeclarations(schemaDefinitions, PostgreSqlSchemaViews);
		await client.query("begin");
		try {
			for (const definition of schemaDefinitions) await client.query(definition);
			const functionsAfter = await readFunctionDefinitions(client);
			const triggersAfter = await readTriggerDefinitions(client);
			const viewsAfter = await readViewDefinitions(client);
			assertPostgreSqlDefinitionsComplete(
				functionsAfter,
				PostgreSqlSchemaFunctionNames,
				"function",
			);
			assertPostgreSqlDefinitionsComplete(triggersAfter, expectedTriggers, "trigger");
			assertPostgreSqlViewManifest(viewsAfter, PostgreSqlSchemaViews);
			assertDefinitionsEqual(functionsBefore, functionsAfter, "function");
			assertDefinitionsEqual(triggersBefore, triggersAfter, "trigger");
			assertPostgreSqlViewDefinitionsEqual(viewsBefore, viewsAfter);
		} finally {
			await client.query("rollback");
		}
		console.info(
			"Canonical PostgreSQL functions, triggers, and current Structure views match migration replay.",
		);
	} finally {
		await client.end();
	}
}

await main();
