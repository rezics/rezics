import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
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
} from "../src/services/authorization/identities";
import {
	applyAccessGroupCommand,
	readAccessGroupSnapshot,
	AccessGroupConflict,
	AccessGroupAdmissionDenied,
	AccessGroupAdmissionUnavailable,
	type AccessGroupCommand,
} from "../src/services/authorization/groups";

const connectionString = process.env.DATABASE_ADMIN_URL;
assert.ok(connectionString && process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1");
const target = new URL(connectionString);
assert.ok(
	["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/.test(target.pathname),
);
const first = new Client({ connectionString, statement_timeout: 10000 }),
	second = new Client({ connectionString, statement_timeout: 10000 });
const db = drizzle({ client: first }),
	peer = drizzle({ client: second });
let assertions = 0;
const equal = (a: unknown, b: unknown) => {
	assert.deepEqual(a, b);
	assertions++;
};
function hasCode(error: unknown, code: string): boolean {
	return (
		error instanceof Error &&
		(("code" in error && error.code === code) || ("cause" in error && hasCode(error.cause, code)))
	);
}
async function rejected(action: Promise<unknown>, code: string) {
	await assert.rejects(action, (error) => hasCode(error, code));
	assertions++;
}
async function blocked(pid: number, by: number) {
	const end = Date.now() + 5000;
	do {
		if (
			(await first.query("select $2::integer=any(pg_blocking_pids($1)) as blocked", [pid, by]))
				.rows[0].blocked
		) {
			assertions++;
			return;
		}
		await setTimeout(10);
	} while (Date.now() < end);
	throw Error("Expected Group contention");
}
try {
	await first.connect();
	await second.connect();
	const firstPid = (await first.query("select pg_backend_pid() as pid")).rows[0].pid,
		secondPid = (await second.query("select pg_backend_pid() as pid")).rows[0].pid;
	const operatorAuthUserId = randomUUID();
	await first.query("insert into users(id,name,email) values ($1,'Group fixture',$2)", [
		operatorAuthUserId,
		`${operatorAuthUserId}@group-fixture.invalid`,
	]);
	const authoritySubjectId = await db.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "principal", id: operatorAuthUserId }),
	);
	const scopeId = await db.transaction((tx) =>
		allocateAccessScope(tx, { kind: "account", id: operatorAuthUserId }),
	);
	const otherScope = await db.transaction((tx) => allocateAccessScope(tx, { kind: "platform" }));
	const actor = { operatorAuthUserId, authoritySubjectId };
	const create = (
		parentId: string | null = null,
		scope = scopeId,
	): Extract<AccessGroupCommand, { operation: "create" }> => ({
		operation: "create",
		scopeId: scope,
		groupId: randomUUID(),
		parentId,
		expectedVersion: 0,
		operationId: randomUUID(),
		presentation: { label: "Fixture Group", description: null },
		...actor,
	});
	const run = (command: AccessGroupCommand) =>
		db.transaction((tx) => applyAccessGroupCommand(tx, command, sql<boolean>`true`));
	const move = (
		groupId: string,
		parentId: string | null,
		expectedVersion = 1,
	): AccessGroupCommand => ({
		operation: "reparent",
		scopeId,
		groupId,
		parentId,
		expectedVersion,
		operationId: randomUUID(),
		...actor,
	});
	const retire = (groupId: string, expectedVersion = 1): AccessGroupCommand => ({
		operation: "retire",
		scopeId,
		groupId,
		expectedVersion,
		operationId: randomUUID(),
		...actor,
	});
	const height = async (id: string) =>
		(await first.query("select subtree_height from access_group where id=$1", [id])).rows[0]
			.subtree_height;
	const rootCommand = create(),
		root = await run(rootCommand),
		child = await run(create(root.groupId));
	equal(await height(root.groupId), 2);
	equal(await height(child.groupId), 1);
	equal(await run(rootCommand), root);
	await assert.rejects(run({ ...rootCommand, expectedVersion: 1 }), AccessGroupConflict);
	assertions++;
	await rejected(run(move(root.groupId, root.groupId)), "23514");
	await rejected(run(move(root.groupId, child.groupId)), "23514");
	await rejected(run(retire(root.groupId)), "23514");
	const otherOperator = randomUUID();
	await first.query("insert into users(id,name,email) values ($1,'Other Group operator',$2)", [
		otherOperator,
		`${otherOperator}@group-fixture.invalid`,
	]);
	await rejected(run({ ...create(), operatorAuthUserId: otherOperator }), "23514");
	await assert.rejects(
		run({ ...rootCommand, operatorAuthUserId: otherOperator }),
		AccessGroupConflict,
	);
	assertions++;
	const foreign = await run(create(null, otherScope));
	// SQL callers cannot leave an unapplied event or bypass the same-scope parent invariant.
	await first.query("begin");
	await first.query(
		"insert into access_group_event(group_id,version,operation_id,request_digest,operation,state_after,parent_after_id,label,operator_auth_user_id,authority_subject_id) values ($1,2,$2,repeat('0',64),'update','active',null,'Unapplied metadata',$3,$4)",
		[root.groupId, randomUUID(), operatorAuthUserId, authoritySubjectId],
	);
	await rejected(first.query("commit"), "23514");
	equal(
		(await first.query("select version from access_group where id=$1", [root.groupId])).rows[0]
			.version,
		"1",
	);
	await first.query("begin");
	await first.query(
		"insert into access_group_event(group_id,version,operation_id,request_digest,operation,state_after,parent_after_id,label,operator_auth_user_id,authority_subject_id) values ($1,2,$2,repeat('0',64),'reparent','active',$3,'Fixture Group',$4,$5)",
		[root.groupId, randomUUID(), foreign.groupId, operatorAuthUserId, authoritySubjectId],
	);
	await rejected(
		first.query("update access_group set version=2,parent_id=$1 where id=$2", [
			foreign.groupId,
			root.groupId,
		]),
		"23514",
	);
	await first.query("rollback");
	await assert.rejects(run(create(foreign.groupId)), AccessGroupConflict);
	assertions++;
	await assert.rejects(run(move(child.groupId, root.groupId)), AccessGroupConflict);
	assertions++;
	await rejected(
		first.query("update access_group set subtree_height=8 where id=$1", [child.groupId]),
		"23514",
	);
	await rejected(first.query("delete from access_group where id=$1", [child.groupId]), "55000");
	await rejected(
		first.query("update access_group set scope_id=$1 where id=$2", [otherScope, child.groupId]),
		"55000",
	);
	await rejected(
		first.query("delete from access_group_event where group_id=$1", [child.groupId]),
		"55000",
	);
	await rejected(first.query("insert into access_group(scope_id) values ($1)", [scopeId]), "23514");
	const detached = await run(move(child.groupId, null));
	equal(detached.parentId, null);
	equal(await height(root.groupId), 1);
	await run(retire(child.groupId, 2));
	await assert.rejects(run(move(child.groupId, root.groupId, 3)), AccessGroupConflict);
	assertions++;
	await assert.rejects(run(create(child.groupId)), AccessGroupConflict);
	assertions++;
	equal(
		(
			await db.transaction((tx) =>
				readAccessGroupSnapshot(tx, { scopeId, groupId: child.groupId, version: 1 }),
			)
		)?.parentId,
		root.groupId,
	);
	equal(
		(
			await db.transaction((tx) =>
				readAccessGroupSnapshot(tx, { scopeId, groupId: child.groupId, version: "current" }),
			)
		)?.state,
		"retired",
	);
	equal(
		await db.transaction((tx) =>
			readAccessGroupSnapshot(tx, { scopeId: otherScope, groupId: child.groupId, version: 1 }),
		),
		null,
	);
	const chain = [await run(create())];
	for (let i = 1; i < 8; i++) chain.push(await run(create(chain[i - 1]!.groupId)));
	equal(await height(chain[0]!.groupId), 8);
	await rejected(run(create(chain[7]!.groupId)), "23514");
	const branch = await run(create()),
		leaf = await run(create(branch.groupId));
	await rejected(run(move(branch.groupId, chain[6]!.groupId)), "23514");
	await run(move(chain[7]!.groupId, null));
	equal(await height(chain[0]!.groupId), 7);
	await run(move(branch.groupId, chain[4]!.groupId));
	equal(await height(chain[0]!.groupId), 7);
	await run(retire(leaf.groupId));
	equal(await height(branch.groupId), 1);
	await run(move(chain[6]!.groupId, null));
	equal(await height(chain[0]!.groupId), 6);

	// Opposite parent moves serialize; the loser cannot commit a cycle.
	const a = await run(create()),
		b = await run(create());
	const ready = Promise.withResolvers<void>(),
		release = Promise.withResolvers<void>();
	const writer = db.transaction(async (tx) => {
		await applyAccessGroupCommand(tx, move(a.groupId, b.groupId), sql<boolean>`true`);
		ready.resolve();
		await release.promise;
	});
	await ready.promise;
	const competitor = peer.transaction((tx) =>
		applyAccessGroupCommand(tx, move(b.groupId, a.groupId), sql<boolean>`true`),
	);
	const cycle = rejected(competitor, "23514");
	await blocked(secondPid, firstPid);
	release.resolve();
	await writer;
	await cycle;
	equal(await height(b.groupId), 2);
	// A stale stronger-isolation snapshot fails on the shared tree row instead of missing the competing edge.
	const c = await run(create()),
		d = await run(create());
	await peer.transaction(
		async (tx) => {
			await tx.execute(
				sql`select version from public.access_group_tree where scope_id=${scopeId}::uuid`,
			);
			await run(move(c.groupId, d.groupId));
			await rejected(
				applyAccessGroupCommand(tx, move(d.groupId, c.groupId), sql<boolean>`true`),
				"40001",
			);
		},
		{ isolationLevel: "repeatable read" },
	);
	equal(await height(d.groupId), 2);

	// Unrelated scopes can change while this scope's tree is locked.
	await first.query("begin");
	await first.query("select scope_id from access_group_tree where scope_id=$1 for update", [
		scopeId,
	]);
	const independent = await peer.transaction((tx) =>
		applyAccessGroupCommand(tx, create(null, otherScope), sql<boolean>`true`),
	);
	equal(independent.version, 1);
	await first.query("commit");
	const readReady = Promise.withResolvers<void>(),
		readRelease = Promise.withResolvers<void>();
	const reader = db.transaction(async (tx) => {
		const snapshot = await readAccessGroupSnapshot(tx, {
			scopeId,
			groupId: root.groupId,
			version: "current",
		});
		readReady.resolve();
		await readRelease.promise;
		return snapshot;
	});
	await readReady.promise;
	const retiring = peer.transaction((tx) =>
		applyAccessGroupCommand(tx, retire(root.groupId), sql<boolean>`true`),
	);
	await blocked(secondPid, firstPid);
	readRelease.resolve();
	equal((await reader)?.state, "active");
	await retiring;
	equal(
		(
			await db.transaction((tx) =>
				readAccessGroupSnapshot(tx, { scopeId, groupId: root.groupId, version: "current" }),
			)
		)?.state,
		"retired",
	);
	for (const [predicate, error] of [
		[sql<boolean>`false`, AccessGroupAdmissionDenied],
		[sql<boolean | null>`null`, AccessGroupAdmissionUnavailable],
	] as const) {
		await assert.rejects(
			db.transaction((tx) => applyAccessGroupCommand(tx, rootCommand, predicate)),
			error,
		);
		assertions++;
	}

	equal(await run(rootCommand), root);
	const maxPresentation = {
		...create(),
		presentation: { label: "界".repeat(170) + "ab", description: "x".repeat(4096) },
	};
	const maximum = await run(maxPresentation);
	equal(
		(
			await db.transaction((tx) =>
				readAccessGroupSnapshot(tx, { scopeId, groupId: maximum.groupId, version: "current" }),
			)
		)?.label,
		maxPresentation.presentation.label,
	);
	await assert.rejects(
		run({ ...create(), presentation: { label: "界".repeat(171), description: null } }),
	);
	assertions++;
	await assert.rejects(
		run({ ...create(), presentation: { label: "Fixture", description: "x".repeat(4097) } }),
	);
	assertions++;
	const gate = await run(create()),
		parent = await run(create());
	const gateCommand: AccessGroupCommand = {
		operation: "update",
		scopeId,
		groupId: gate.groupId,
		expectedVersion: 1,
		operationId: randomUUID(),
		presentation: { label: "Edited fixture", description: null },
		...actor,
	};
	for (const waitAt of ["tree", "head", "parent", "audit"]) {
		const expiry = (
			await first.query("select clock_timestamp()+interval '500 milliseconds' as expiry")
		).rows[0].expiry as Date;
		await first.query("begin");
		if (waitAt === "tree")
			await first.query("select scope_id from access_group_tree where scope_id=$1 for update", [
				scopeId,
			]);
		else if (waitAt === "audit")
			await first.query("select id from users where id=$1 for update", [operatorAuthUserId]);
		else
			await first.query("select id from access_group where id=$1 for update", [
				waitAt === "head" ? gate.groupId : parent.groupId,
			]);
		const command = waitAt === "parent" ? move(gate.groupId, parent.groupId) : gateCommand;
		const pending = peer.transaction(async (tx) => {
			await assert.rejects(
				applyAccessGroupCommand(
					tx,
					command,
					sql<boolean>`clock_timestamp()<${expiry}::timestamptz`,
				),
				AccessGroupAdmissionDenied,
			);
		});
		await blocked(secondPid, firstPid);
		if (waitAt === "audit") {
			assert.match(
				(await first.query("select query from pg_stat_activity where pid=$1", [secondPid])).rows[0]
					.query,
				/insert into "access_group_event"/,
			);
			assertions++;
		}
		await first.query(
			"select pg_sleep(greatest(0,extract(epoch from($1::timestamptz-clock_timestamp())))+0.05)",
			[expiry],
		);
		await first.query("commit");
		await pending;
		assertions++;
		equal(
			(
				await db.transaction((tx) =>
					readAccessGroupSnapshot(tx, { scopeId, groupId: gate.groupId, version: "current" }),
				)
			)?.version,
			1,
		);
		equal(
			(
				await first.query(
					"select count(*)::integer as count from access_group_event where group_id=$1",
					[gate.groupId],
				)
			).rows[0].count,
			1,
		);
	}
	const treeBefore = (
		await first.query("select version from access_group_tree where scope_id=$1", [scopeId])
	).rows[0].version;
	await db.transaction(async (tx) => {
		await assert.rejects(
			applyAccessGroupCommand(
				tx,
				gateCommand,
				sql<
					boolean | null
				>`case when exists(select 1 from public.access_group_event where group_id=${gate.groupId}::uuid and operation_id=${gateCommand.operationId}::uuid) then null::boolean else true end`,
			),
			AccessGroupAdmissionUnavailable,
		);
	});
	assertions++;
	equal(
		(await first.query("select version from access_group_tree where scope_id=$1", [scopeId]))
			.rows[0].version,
		treeBefore,
	);

	// A reviewed tree-version predicate sees the pre-change tree through final admission.
	const reviewed = await run(create());
	const reviewedVersion = (
		await first.query("select version from access_group_tree where scope_id=$1", [scopeId])
	).rows[0].version;
	const reviewedResult = await db.transaction((tx) =>
		applyAccessGroupCommand(
			tx,
			{
				...gateCommand,
				groupId: reviewed.groupId,
				operationId: randomUUID(),
			},
			sql<boolean>`exists(select 1 from public.access_group_tree where scope_id=${scopeId}::uuid and version=${reviewedVersion}::bigint)`,
		),
	);
	equal(reviewedResult.version, 2);

	const wide = await run(create()),
		sampleSeed = randomUUID();
	await first.query("begin");
	await first.query(
		`create temporary table group_sample_ids on commit drop as select overlay(overlay(md5($1||':'||i) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid as id from generate_series(1,1000)i`,
		[sampleSeed],
	);
	await first.query("insert into access_group(id,scope_id) select id,$1 from group_sample_ids", [
		scopeId,
	]);
	await first.query(
		"insert into access_group_event(group_id,version,operation_id,request_digest,operation,state_after,parent_after_id,label,operator_auth_user_id,authority_subject_id) select id,1,uuidv7(),repeat('0',64),'create','active',$1,'Sample child',$2,$3 from group_sample_ids",
		[wide.groupId, operatorAuthUserId, authoritySubjectId],
	);
	await first.query(
		"update access_group set version=1,state='active',parent_id=$1 where id in(select id from group_sample_ids)",
		[wide.groupId],
	);
	await first.query("commit");
	equal(await height(wide.groupId), 2);
	await run(move(wide.groupId, parent.groupId));
	equal(await height(parent.groupId), 3);
	equal(
		(
			await first.query(
				"select count(*)::integer as count from access_group where parent_id=$1 and version=1",
				[wide.groupId],
			)
		).rows[0].count,
		1000,
	);
	await db.transaction(async (tx) => {
		for (let version = 1; version <= 100; version++)
			await applyAccessGroupCommand(
				tx,
				{
					...gateCommand,
					expectedVersion: version,
					operationId: randomUUID(),
					presentation: { label: `Fixture revision ${version}`, description: null },
				},
				sql<boolean>`true`,
			);
	});
	await first.query("analyze access_group,access_group_tree,access_group_event");
	const measured: unknown[] = [];
	for (const [table, index, query, args] of [
		[
			"access_group",
			"access_group_parent_height_idx",
			"select subtree_height from access_group where scope_id=$1 and parent_id=$2 and state='active' order by subtree_height desc nulls last,id limit 1",
			[scopeId, wide.groupId],
		],
		[
			"access_group_event",
			"access_group_event_pkey",
			"select * from access_group_event where group_id=$1 and version=51",
			[gate.groupId],
		],
	] as const) {
		const plan = (await first.query(`explain(analyze,buffers,format json) ${query}`, [...args]))
			.rows[0]["QUERY PLAN"];
		assert.ok(JSON.stringify(plan).includes(index));
		assertions++;
		if (table === "access_group") {
			const scan = plan[0].Plan.Plans[0];
			assert.match(scan["Node Type"], /^Index (?:Only )?Scan$/);
			equal(scan["Actual Rows"], 1);
			assert.doesNotMatch(JSON.stringify(plan), /"Node Type":"(?:Seq Scan|Sort)"/);
			assertions += 2;
		}
		const bytes = (
			await first.query(
				`select count(*)::integer as rows,avg(pg_column_size(t))::float8 as tuple_bytes,pg_table_size('${table}')::float8 as table_bytes,pg_indexes_size('${table}')::float8 as index_bytes from ${table} t`,
			)
		).rows[0];
		measured.push({ table, plan, bytes });
	}
	measured.push({
		table: "access_group_tree",
		bytes: (
			await first.query(
				"select count(*)::integer as rows,avg(pg_column_size(t))::float8 as tuple_bytes,pg_table_size('access_group_tree')::float8 as table_bytes,pg_indexes_size('access_group_tree')::float8 as index_bytes from access_group_tree t",
			)
		).rows[0],
	});
	const repo = new URL("../../../", import.meta.url),
		sourceDigests: Record<string, string> = {};
	for (const path of [
		"services/main/scripts/check-access-groups.ts",
		"services/main/src/services/authorization/groups.ts",
		"libraries/schema/src/postgres/access/access-group.ts",
		"services/main/src/services/database/schema/postgres/access-group.sql",
		"services/main/src/services/database/migrations/atlas.sum",
	])
		sourceDigests[path] = createHash("sha256")
			.update(await readFile(new URL(path, repo)))
			.digest("hex");
	console.info(
		JSON.stringify({
			baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: fileURLToPath(repo),
				encoding: "utf8",
			}).trim(),
			sourceDigests,
			node: process.version,
			runtime: (await first.query("select version() as postgres")).rows[0],
			assertions,
			sampleSeed,
			measured,
		}),
	);
} finally {
	await first.query("rollback").catch(() => {});
	await second.query("rollback").catch(() => {});
	await first.end();
	await second.end();
}
