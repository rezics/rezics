import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import {
	allocateAccessScope,
	allocateAccessSubject,
	resolveAccessScope,
	resolveAccessSubject,
} from "../src/services/authorization/identities";
import { allocateReferenceValue } from "../src/services/units/reference-value";

const connectionString = process.env.DATABASE_ADMIN_URL;
assert.ok(connectionString && process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1");
const target = new URL(connectionString);
assert.ok(
	["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/.test(target.pathname),
);
const first = new Client({ connectionString, statement_timeout: 10000 });
const second = new Client({ connectionString, statement_timeout: 10000 });
const firstDb = drizzle({ client: first }),
	secondDb = drizzle({ client: second });
const sources = new URL("../../../", import.meta.url);
let assertions = 0;
function equal(actual: unknown, expected: unknown) {
	assert.deepEqual(actual, expected);
	assertions++;
}
async function rejected(query: string, values: unknown[], code: string) {
	await assert.rejects(
		first.query(query, values),
		(error: unknown) => error instanceof Error && "code" in error && error.code === code,
	);
	assertions++;
}
async function blocked(blockedPid: number, blocker: number) {
	const deadline = Date.now() + 5000;
	do {
		if (
			(
				await first.query("select $2::integer = any(pg_blocking_pids($1)) as blocked", [
					blockedPid,
					blocker,
				])
			).rows[0].blocked
		) {
			assertions++;
			return;
		}
		await setTimeout(10);
	} while (Date.now() < deadline);
	throw new Error("Expected competing access identity allocation to block");
}
try {
	await first.connect();
	await second.connect();
	const firstPid = (await first.query("select pg_backend_pid() as pid")).rows[0].pid;
	const secondPid = (await second.query("select pg_backend_pid() as pid")).rows[0].pid;
	const principal = randomUUID(),
		otherPrincipal = randomUUID(),
		entity = principal;
	for (const id of [principal, otherPrincipal])
		await first.query("insert into public.users(id,name,email) values ($1,'Access fixture',$2)", [
			id,
			`${id}@access-fixture.invalid`,
		]);
	await first.query("insert into public.entity_identity(id,shape) values ($1,'unknown')", [entity]);
	const ref = await firstDb.transaction((tx) =>
		allocateReferenceValue(tx, { owner: "entity", id: entity }),
	);
	const principalSubject = await firstDb.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "principal", id: principal }),
	);
	const entitySubject = await firstDb.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "entity", id: entity }),
	);
	assert.notEqual(principalSubject, entitySubject);
	assertions++;
	for (const [id, value] of [
		[principalSubject, { kind: "principal", id: principal }],
		[entitySubject, { kind: "entity", id: entity }],
	] as const) {
		equal(await firstDb.transaction((tx) => allocateAccessSubject(tx, value)), id);
		equal(await firstDb.transaction((tx) => resolveAccessSubject(tx, id)), value);
	}
	for (const value of [
		{ kind: "platform" },
		{ kind: "account", id: principal },
		{ kind: "resource", referenceValueId: ref },
	] as const) {
		const id = await firstDb.transaction((tx) => allocateAccessScope(tx, value));
		equal(await firstDb.transaction((tx) => allocateAccessScope(tx, value)), id);
		equal(await firstDb.transaction((tx) => resolveAccessScope(tx, id)), value);
	}
	equal(await firstDb.transaction((tx) => resolveAccessSubject(tx, randomUUID())), null);
	equal(await firstDb.transaction((tx) => resolveAccessScope(tx, randomUUID())), null);
	await rejected("insert into public.access_subject default values", [], "23514");
	await rejected(
		"insert into public.access_subject(auth_user_id,entity_id) values ($1,$1)",
		[principal],
		"23514",
	);
	await rejected("insert into public.access_scope default values", [], "23514");
	await rejected(
		"insert into public.access_scope(platform_root) values ('unregistered')",
		[],
		"23514",
	);
	await rejected(
		"insert into public.access_scope(platform_root,auth_user_id) values ('platform',$1)",
		[principal],
		"23514",
	);
	await rejected(
		"insert into public.access_scope(auth_user_id,unit_ref) values ($1,$2)",
		[principal, ref],
		"23514",
	);
	await rejected(
		"insert into public.access_scope(platform_root,unit_ref) values ('platform',$1)",
		[ref],
		"23514",
	);
	for (const [table, column, existing] of [
		["access_subject", "auth_user_id", principal],
		["access_subject", "entity_id", entity],
		["access_scope", "auth_user_id", principal],
		["access_scope", "unit_ref", ref],
	] as const) {
		await rejected(`insert into public.${table}(${column}) values ($1)`, [randomUUID()], "23503");
		await rejected(`insert into public.${table}(${column}) values ($1)`, [existing], "23505");
		await rejected(
			`update public.${table} set ${column}=$1 where ${column}=$2`,
			[randomUUID(), existing],
			"55000",
		);
		await rejected(
			`update public.${table} set id=$1 where ${column}=$2`,
			[randomUUID(), existing],
			"55000",
		);
		await rejected(`delete from public.${table} where ${column}=$1`, [existing], "55000");
	}
	await rejected("insert into public.access_scope(platform_root) values ('platform')", [], "23505");
	await rejected("delete from public.users where id=$1", [principal], "23001");
	// Immutable identity is not participation or a grant; creating it admits neither.
	equal(
		(
			await first.query(
				"select count(*)::integer as count from public.auth_entity where auth_user_id=$1 or entity_id=$1",
				[principal],
			)
		).rows[0].count,
		0,
	);
	equal(
		(
			await first.query(
				"select count(*)::integer as count from public.entity_participation where entity_id=$1",
				[entity],
			)
		).rows[0].count,
		0,
	);
	await first.query(
		"update public.users set erased_at=clock_timestamp(),name='',email=$2 where id=$1",
		[principal, `${principal}@erased.invalid`],
	);
	equal(await firstDb.transaction((tx) => resolveAccessSubject(tx, principalSubject)), {
		kind: "principal",
		id: principal,
	});
	// Commit and rollback races both reuse the allocator protocol, without rewriting a winner.
	for (const commit of [true, false]) {
		const actor = randomUUID();
		await first.query("insert into public.users(id,name,email) values ($1,'Race fixture',$2)", [
			actor,
			`${actor}@access-fixture.invalid`,
		]);
		await first.query("begin");
		const winner = (
			await first.query(
				"insert into public.access_subject(auth_user_id) values ($1) returning id",
				[actor],
			)
		).rows[0].id;
		const competing = secondDb.transaction((tx) =>
			allocateAccessSubject(tx, { kind: "principal", id: actor }),
		);
		await blocked(secondPid, firstPid);
		await first.query(commit ? "commit" : "rollback");
		const observed = await competing;
		if (commit) equal(observed, winner);
		else {
			assert.notEqual(observed, winner);
			assertions++;
		}
		equal(
			await firstDb.transaction((tx) =>
				allocateAccessSubject(tx, { kind: "principal", id: actor }),
			),
			observed,
		);
	}
	const absent = randomUUID();
	await first.query("insert into public.users(id,name,email) values ($1,'Delete fixture',$2)", [
		absent,
		`${absent}@access-fixture.invalid`,
	]);
	await first.query("begin");
	await first.query("delete from public.users where id=$1", [absent]);
	const admission = secondDb.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "principal", id: absent }),
	);
	const denied = assert.rejects(
		admission,
		(error: unknown) =>
			error instanceof Error &&
			"cause" in error &&
			error.cause instanceof Error &&
			"code" in error.cause &&
			error.cause.code === "23503",
	);
	await blocked(secondPid, firstPid);
	await first.query("commit");
	await denied;
	assertions++;

	// Scope allocation has its own unique paths and must satisfy the same transaction protocol.
	for (const commit of [true, false]) {
		const owner = randomUUID();
		await first.query("insert into public.users(id,name,email) values ($1,'Scope race',$2)", [
			owner,
			`${owner}@access-fixture.invalid`,
		]);
		await first.query("begin");
		const winner = (
			await first.query("insert into public.access_scope(auth_user_id) values ($1) returning id", [
				owner,
			])
		).rows[0].id;
		const competing = secondDb.transaction((tx) =>
			allocateAccessScope(tx, { kind: "account", id: owner }),
		);
		await blocked(secondPid, firstPid);
		await first.query(commit ? "commit" : "rollback");
		const observed = await competing;
		if (commit) equal(observed, winner);
		else {
			assert.notEqual(observed, winner);
			assertions++;
		}
	}
	const repeatableOwner = randomUUID();
	await first.query("insert into public.users(id,name,email) values ($1,'Snapshot race',$2)", [
		repeatableOwner,
		`${repeatableOwner}@access-fixture.invalid`,
	]);
	const snapshotReady = Promise.withResolvers<void>(),
		startAllocation = Promise.withResolvers<void>();
	const repeatable = secondDb.transaction(
		async (tx) => {
			await tx.execute(
				sql`select id from public.access_scope where auth_user_id=${repeatableOwner}::uuid`,
			);
			snapshotReady.resolve();
			await startAllocation.promise;
			return allocateAccessScope(tx, { kind: "account", id: repeatableOwner });
		},
		{ isolationLevel: "repeatable read" },
	);
	const serializationFailure = assert.rejects(
		repeatable,
		(error: unknown) =>
			error instanceof Error &&
			"cause" in error &&
			error.cause instanceof Error &&
			"code" in error.cause &&
			error.cause.code === "40001",
	);
	await snapshotReady.promise;
	await first.query("begin");
	const repeatableWinner = (
		await first.query("insert into public.access_scope(auth_user_id) values ($1) returning id", [
			repeatableOwner,
		])
	).rows[0].id;
	startAllocation.resolve();
	await blocked(secondPid, firstPid);
	await first.query("commit");
	await serializationFailure;
	assertions++;
	equal(
		await secondDb.transaction((tx) =>
			allocateAccessScope(tx, { kind: "account", id: repeatableOwner }),
		),
		repeatableWinner,
	);

	// Bounded warm sample: measure the registries separately from account storage.
	const sample = process.env.REZICS_ACCESS_IDENTITY_SAMPLE_SEED ?? randomUUID();
	await first.query(
		`insert into public.users(id,name,email)
	 select overlay(overlay(md5($1 || i::text) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid, 'Access sample', md5($1 || i::text) || '@access-sample.invalid'
	 from generate_series(1,10000) i`,
		[sample],
	);
	await first.query(
		`insert into public.access_subject(auth_user_id) select overlay(overlay(md5($1 || i::text) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid from generate_series(1,10000) i`,
		[sample],
	);
	await first.query(
		`insert into public.access_scope(auth_user_id) select overlay(overlay(md5($1 || i::text) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid from generate_series(1,10000) i`,
		[sample],
	);
	const measured: unknown[] = [];
	const sampleOwner = (
		await first.query(
			"select overlay(overlay(md5($1 || '5000') placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid as id",
			[sample],
		)
	).rows[0].id;
	for (const [table, index] of [
		["access_subject", "access_subject_principal_key"],
		["access_scope", "access_scope_account_key"],
	] as const) {
		await first.query(`analyze public.${table}`);
		const plan = (
			await first.query(
				`explain(analyze,buffers,format json) select id from public.${table} where auth_user_id=$1`,
				[sampleOwner],
			)
		).rows[0]["QUERY PLAN"];
		assert.ok(JSON.stringify(plan).includes(index));
		assertions++;
		const bytes = (
			await first.query(
				`select count(*)::integer as rows, avg(pg_column_size(t))::float8 as tuple_bytes, pg_relation_size('public.${table}')::float8 as heap_bytes, pg_indexes_size('public.${table}')::float8 as index_bytes from public.${table} t`,
			)
		).rows[0];
		measured.push({ table, plan, bytes });
	}
	const sourceDigests: Record<string, string> = {};
	for (const path of [
		"services/main/scripts/check-access-identities.ts",
		"libraries/access/src/identity.ts",
		"services/main/src/services/units/immutable-reference.ts",
		"services/main/src/services/authorization/identities.ts",
		"libraries/schema/src/postgres/access/access-identity.ts",
		"services/main/src/services/database/schema/postgres/access-identity.sql",
		"services/main/src/services/database/migrations/atlas.sum",
	])
		sourceDigests[path] = createHash("sha256")
			.update(await readFile(new URL(path, sources)))
			.digest("hex");
	console.info(
		JSON.stringify({
			baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: fileURLToPath(sources),
				encoding: "utf8",
			}).trim(),
			sourceDigests,
			node: process.version,
			runtime: (
				await first.query(
					"select version() as postgres, current_setting('default_transaction_isolation') as default_isolation, current_setting('fsync') as fsync, current_setting('full_page_writes') as full_page_writes",
				)
			).rows[0],
			fixtureStorage: process.env.REZICS_DISPOSABLE_STORAGE ?? "container-default",
			sampleSeed: sample,
			assertions,
			measured,
		}),
	);
} finally {
	await first.query("rollback").catch(() => {});
	await second.query("rollback").catch(() => {});
	await first.end();
	await second.end();
}
