import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { CatalogOwnerValues, UnitOwnerValues } from "@rezics/reference";
import { checkRevisionReferences } from "./check-revision-references";

const connectionString = process.env.DATABASE_ADMIN_URL;
assert(connectionString, "DATABASE_ADMIN_URL is required");
assert.equal(process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE, "1");
const target = new URL(connectionString);
assert(
	["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) && target.port !== "15432",
	"Reference fixtures require an isolated loopback database",
);
const first = new Client({ connectionString, statement_timeout: 10000 });
const second = new Client({ connectionString, statement_timeout: 10000 });

function databaseCode(error: unknown, code: string): boolean {
	const cause = error instanceof Error && "cause" in error ? error.cause : error;
	return cause instanceof Error && "code" in cause && cause.code === code;
}

async function rejected(client: Client, query: string, values: unknown[], code: string) {
	await assert.rejects(
		client.query(query, values),
		(error: unknown) => error instanceof Error && "code" in error && error.code === code,
		`Expected PostgreSQL ${code} for ${query}`,
	);
}

async function waitForBlock(observer: Client, blockedPid: number, blockingPid: number) {
	const deadline = Date.now() + 5000;
	do {
		const result = await observer.query<{ blocked: boolean }>(
			"select $2::integer = any(pg_blocking_pids($1)) as blocked",
			[blockedPid, blockingPid],
		);
		if (result.rows[0]?.blocked) return;
		await setTimeout(10);
	} while (Date.now() < deadline);
	throw new Error("Expected reference admission to wait on the competing transaction");
}

try {
	await first.connect();
	await second.connect();
	const database = await first.query<{ name: string }>("select current_database() as name");
	assert.match(database.rows[0]?.name ?? "", /^rezics_atlas(?:_[a-z0-9_]+)?$/u);
	await first.query("select id from public.reference_value limit 0");
	const { allocateReferenceValue, resolveReferenceValue, findReferenceValueByNativeId } =
		await import("../src/services/units/reference-value");
	const firstDb = drizzle({ client: first });
	const secondDb = drizzle({ client: second });
	const firstPid = (await first.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]!
		.pid;
	const secondPid = (await second.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]!
		.pid;

	// Owners exist independently; no public visibility or fabricated source is needed.
	const targets = [
		randomUUID(),
		randomUUID(),
		randomUUID(),
		randomUUID(),
		randomUUID(),
		randomUUID(),
	] as const;
	for (const id of targets) {
		await first.query("insert into public.reference_identity (id, shape) values ($1, 'unknown')", [
			id,
		]);
	}
	const [ownerId, alternativeId, commitId, rollbackId, deletedId, unreferencedId] = targets;
	assert.equal(
		(
			await first.query("select id from public.reference_value where target_reference_id = $1", [
				ownerId,
			])
		).rowCount,
		0,
	);

	const reference = { owner: "reference", id: ownerId } as const;
	const valueId = await firstDb.transaction((tx) => allocateReferenceValue(tx, reference));
	assert.equal(await firstDb.transaction((tx) => allocateReferenceValue(tx, reference)), valueId);
	assert.deepEqual(
		await firstDb.transaction((tx) => resolveReferenceValue(tx, valueId)),
		reference,
	);
	assert.equal(await firstDb.transaction((tx) => resolveReferenceValue(tx, randomUUID())), null);
	for (const owner of CatalogOwnerValues) {
		const id = randomUUID();
		await first.query(`insert into public.${owner}_identity (id, shape) values ($1, 'unknown')`, [
			id,
		]);
		const catalogReference = { owner, id };
		const allocated = await firstDb.transaction((tx) =>
			allocateReferenceValue(tx, catalogReference),
		);
		assert.deepEqual(
			await firstDb.transaction((tx) => resolveReferenceValue(tx, allocated)),
			catalogReference,
		);
		assert.equal(
			await firstDb.transaction((tx) => allocateReferenceValue(tx, catalogReference)),
			allocated,
		);
	}
	await assert.rejects(
		firstDb.transaction((tx) =>
			allocateReferenceValue(tx, { owner: "reference", id: randomUUID() }),
		),
		(error: unknown) => databaseCode(error, "23503"),
	);

	await rejected(first, "insert into public.reference_value default values", [], "23514");
	await rejected(
		first,
		"insert into public.reference_value (target_reference_id, target_entity_id) values ($1, $2)",
		[ownerId, randomUUID()],
		"23514",
	);
	for (const owner of UnitOwnerValues) {
		// Column names come only from the closed owner registry.
		await rejected(
			first,
			`insert into public.reference_value (target_${owner}_id) values ($1)`,
			[randomUUID()],
			"23503",
		);
	}
	await rejected(
		first,
		"insert into public.reference_value (target_reference_id) values ($1)",
		[ownerId],
		"23505",
	);
	await rejected(
		first,
		"update public.reference_value set target_reference_id = $2 where id = $1",
		[valueId, alternativeId],
		"55000",
	);
	await rejected(
		first,
		"update public.reference_value set id = $2 where id = $1",
		[valueId, randomUUID()],
		"55000",
	);
	await rejected(first, "delete from public.reference_value where id = $1", [valueId], "55000");
	await rejected(first, "delete from public.reference_identity where id = $1", [ownerId], "23001");
	await first.query("delete from public.reference_identity where id = $1", [unreferencedId]);
	await first.query(
		"update public.reference_identity set visibility = 'public', revision = revision + 1 where id = $1",
		[ownerId],
	);
	assert.deepEqual(
		await firstDb.transaction((tx) => resolveReferenceValue(tx, valueId)),
		reference,
	);

	// Deliberately break only the disposable routing projection. The bridge must
	// continue to prove concrete targets without using a locator as authority.
	const rolledBack = new Error("Roll back routing probe");
	await assert.rejects(
		firstDb.transaction(async (tx) => {
			await tx.execute(
				sql`delete from public.catalog_unit_locator where id in (${ownerId}, ${alternativeId})`,
			);
			assert.deepEqual(await resolveReferenceValue(tx, valueId), reference);
			assert.equal(await allocateReferenceValue(tx, reference), valueId);
			const unrouted = { owner: "reference", id: alternativeId } as const;
			const unroutedValueId = await allocateReferenceValue(tx, unrouted);
			assert.deepEqual(await resolveReferenceValue(tx, unroutedValueId), unrouted);
			throw rolledBack;
		}),
		(error: unknown) => error === rolledBack,
	);

	for (const [id, outcome] of [
		[commitId, "commit"],
		[rollbackId, "rollback"],
	] as const) {
		await first.query("begin");
		const provisionalId = randomUUID();
		await first.query(
			"insert into public.reference_value (id, target_reference_id) values ($1, $2)",
			[provisionalId, id],
		);
		const pending = secondDb.transaction((tx) =>
			allocateReferenceValue(tx, { owner: "reference", id }),
		);
		// Attach rejection immediately so a failed barrier cannot leave an unhandled rejection.
		const result = pending.then(
			(value) => ({ value }),
			(error: unknown) => ({ error }),
		);
		try {
			await waitForBlock(first, secondPid, firstPid);
		} finally {
			await first.query(outcome);
		}
		const completed = await result;
		if ("error" in completed) throw completed.error;
		if (outcome === "commit") assert.equal(completed.value, provisionalId);
		else assert.notEqual(completed.value, provisionalId);
		assert.equal(
			(
				await first.query("select id from public.reference_value where target_reference_id = $1", [
					id,
				])
			).rowCount,
			1,
		);
	}

	// Repeatable read cannot adopt a winner outside its transaction snapshot;
	// propagate serialization failure and let the owner retry the entire command.
	await first.query("begin");
	const serialId = randomUUID();
	await first.query(
		"insert into public.reference_value (id, target_reference_id) values ($1, $2)",
		[serialId, alternativeId],
	);
	const serialized = assert.rejects(
		secondDb.transaction(
			(tx) => allocateReferenceValue(tx, { owner: "reference", id: alternativeId }),
			{ isolationLevel: "repeatable read" },
		),
		(error: unknown) => databaseCode(error, "40001"),
	);
	try {
		await waitForBlock(first, secondPid, firstPid);
	} finally {
		await first.query("commit");
	}
	await serialized;
	assert.equal(
		await secondDb.transaction((tx) =>
			allocateReferenceValue(tx, { owner: "reference", id: alternativeId }),
		),
		serialId,
	);

	// A deletion that wins the concrete FK lock cannot leave a dangling value.
	await first.query("begin");
	await first.query("delete from public.reference_identity where id = $1", [deletedId]);
	const pendingDeletion = secondDb.transaction((tx) =>
		allocateReferenceValue(tx, { owner: "reference", id: deletedId }),
	);
	const rejectedDeletion = assert.rejects(pendingDeletion, (error: unknown) =>
		databaseCode(error, "23503"),
	);
	try {
		await waitForBlock(first, secondPid, firstPid);
	} finally {
		await first.query("commit");
	}
	await rejectedDeletion;

	// Native UUID admission is still owner-local with a collision fence. The
	// bridge must not turn into a prerequisite global identity parent.
	const collisionId = randomUUID();
	await first.query("begin");
	await first.query("insert into public.reference_identity (id, shape) values ($1, 'unknown')", [
		collisionId,
	]);
	const collision = rejected(
		second,
		"insert into public.entity_identity (id, shape) values ($1, 'person')",
		[collisionId],
		"23505",
	);
	try {
		await waitForBlock(first, secondPid, firstPid);
	} finally {
		await first.query("commit");
	}
	await collision;
	const revisionReferences = await checkRevisionReferences(first, second, () =>
		waitForBlock(first, secondPid, firstPid),
	);

	// Deterministic, bounded sample exercises actual planner choices without
	// forcing index scans. It is a query/footprint check, not corpus-scale load.
	for (let start = 1; start <= 10000; start += 500) {
		await first.query(
			`insert into public.reference_identity (id, shape)
			select overlay(overlay(md5('reference-value-20260911:' || i) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid, 'unknown'
			from generate_series($1::integer, $2::integer) i on conflict do nothing`,
			[start, start + 499],
		);
		await first.query(
			`insert into public.reference_value (target_reference_id)
			select overlay(overlay(md5('reference-value-20260911:' || i) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid
			from generate_series($1::integer, $2::integer) i on conflict do nothing`,
			[start, start + 499],
		);
	}
	const [sampleReference] = (
		await first.query<{
			id: string;
			targetId: string;
		}>(`select id, target_reference_id as "targetId" from public.reference_value
		where target_reference_id = overlay(overlay(md5('reference-value-20260911:' || 1) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid`)
	).rows;
	assert(sampleReference);
	assert.deepEqual(
		await firstDb.transaction((tx) => resolveReferenceValue(tx, sampleReference.id)),
		{ owner: "reference", id: sampleReference.targetId },
	);
	assert.deepEqual(
		await firstDb.transaction((tx) => findReferenceValueByNativeId(tx, sampleReference.targetId)),
		{
			valueId: sampleReference.id,
			target: { owner: "reference", id: sampleReference.targetId },
		},
	);
	assert.equal(
		await firstDb.transaction((tx) => findReferenceValueByNativeId(tx, randomUUID())),
		undefined,
	);
	assert.equal(
		(
			await first.query<{ id: string }>("select public.reference_value_native_id($1) as id", [
				sampleReference.id,
			])
		).rows[0]?.id,
		sampleReference.targetId,
	);
	const sameStatementTarget = randomUUID();
	await first.query("insert into public.reference_identity(id, shape) values ($1, 'unknown')", [
		sameStatementTarget,
	]);
	assert.equal(
		(
			await first.query<{ id: string }>(
				`with admitted as (
		insert into public.reference_value(target_reference_id) values ($1) returning id
	) select public.reference_value_native_id(id) as id from admitted`,
				[sameStatementTarget],
			)
		).rows[0]?.id,
		sameStatementTarget,
		"SQL projection sees a value allocated in its calling statement",
	);
	await first.query("analyze public.reference_value");
	const nativeIdPlan = await first.query(
		`explain (analyze, buffers, format json) select * from public.reference_value
		where ${UnitOwnerValues.map((owner) => `target_${owner}_id = $1`).join(" or ")} limit 2`,
		[sampleReference.targetId],
	);
	assert.match(JSON.stringify(nativeIdPlan.rows), /BitmapOr/u);
	assert.doesNotMatch(JSON.stringify(nativeIdPlan.rows), /Seq Scan/u);
	const targetPlan = await first.query(
		`explain (analyze, buffers, format json)
		select id from public.reference_value where target_reference_id = $1 limit 1`,
		[ownerId],
	);
	assert.match(JSON.stringify(targetPlan.rows), /reference_value_target_reference_key/u);
	const valuePlan = await first.query(
		`explain (analyze, buffers, format json)
		select target_reference_id from public.reference_value where id = $1 limit 1`,
		[valueId],
	);
	assert.match(JSON.stringify(valuePlan.rows), /reference_value_pkey/u);
	const footprint = await first.query(`select count(*)::integer as rows,
		avg(pg_column_size(v))::numeric(10,2) as tuple_bytes,
		pg_table_size('public.reference_value') as heap_bytes,
		pg_indexes_size('public.reference_value') as index_bytes
		from public.reference_value v`);
	const runtime = await first.query(`select version() as postgres,
		current_setting('default_transaction_isolation') as default_isolation,
		current_setting('shared_buffers') as shared_buffers,
		current_setting('max_connections') as max_connections,
		current_setting('max_locks_per_transaction') as max_locks_per_transaction,
		current_setting('statement_timeout') as statement_timeout`);
	const sourcePaths = [
		"services/main/Taskfile.yml",
		"services/main/scripts/check-reference-values.ts",
		"services/main/scripts/check-revision-references.ts",
		"services/main/scripts/validate-integrity-constraints.ts",
		"services/main/src/services/units/reference-value.ts",
		"services/main/src/services/units/immutable-reference.ts",
		"services/main/src/services/units/revision-reference.ts",
		"services/main/src/services/units/revision-reference-contract.ts",
		"services/main/src/services/database/schema/reference-value.ts",
		"services/main/src/services/database/schema/revision-reference.ts",
		"services/main/src/services/database/schema/unit-reference-columns.ts",
		"services/main/src/services/database/schema/postgres/reference-value.sql",
		"services/main/src/services/database/schema/postgres/revision-reference.sql",
		"services/main/src/services/database/migrations/atlas.sum",
		"libraries/reference/src/index.ts",
	];
	const repository = new URL("../../../", import.meta.url);
	const sourceDigests: Record<string, string> = {};
	for (const path of sourcePaths) {
		sourceDigests[path] = createHash("sha256")
			.update(await readFile(new URL(path, repository)))
			.digest("hex");
	}
	console.info(
		JSON.stringify({
			baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: fileURLToPath(repository),
				encoding: "utf8",
			}).trim(),
			sourceDigests,
			node: process.version,
			platform: `${process.platform}/${process.arch}`,
			runtime: runtime.rows[0],
			sample: footprint.rows[0],
			revisionReferences,
			nativeIdPlan: nativeIdPlan.rows,
			targetPlan: targetPlan.rows,
			valuePlan: valuePlan.rows,
		}),
	);
	console.info(
		"Identity and exact catalog revision reference constraints, immutable allocation, indexed lookups and two-connection races passed.",
	);
} finally {
	await first.end();
	await second.end();
}
