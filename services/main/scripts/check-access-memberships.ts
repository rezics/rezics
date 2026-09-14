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
	applyAccessMembershipCommand,
	readAccessMembership,
	AccessMembershipConflict,
	AccessMembershipAdmissionDenied,
	AccessMembershipAdmissionUnavailable,
} from "../src/services/authorization/memberships";

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
async function rejected(query: string, args: unknown[], code: string) {
	await assert.rejects(
		first.query(query, args),
		(e: unknown) => e instanceof Error && "code" in e && e.code === code,
	);
	assertions++;
}
async function blocked(pid: number, by: number) {
	const deadline = Date.now() + 5000;
	do {
		if (
			(await first.query("select $2::integer=any(pg_blocking_pids($1)) as blocked", [pid, by]))
				.rows[0].blocked
		) {
			assertions++;
			return;
		}
		await setTimeout(10);
	} while (Date.now() < deadline);
	throw Error("Expected membership contention");
}
try {
	await first.connect();
	await second.connect();
	const firstPid = (await first.query("select pg_backend_pid() as pid")).rows[0].pid,
		secondPid = (await second.query("select pg_backend_pid() as pid")).rows[0].pid;
	const operatorAuthUserId = randomUUID();
	await first.query("insert into users(id,name,email) values ($1,'Membership fixture',$2)", [
		operatorAuthUserId,
		`${operatorAuthUserId}@membership-fixture.invalid`,
	]);
	const subjectId = await db.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "principal", id: operatorAuthUserId }),
	);
	const scopeId = await db.transaction((tx) =>
		allocateAccessScope(tx, { kind: "account", id: operatorAuthUserId }),
	);
	const actor = { operatorAuthUserId, authoritySubjectId: subjectId };
	const admit = {
		scopeId,
		subjectId,
		operation: "admit" as const,
		expectedVersion: 0,
		operationId: randomUUID(),
		...actor,
	};
	const joined = await db.transaction((tx) =>
		applyAccessMembershipCommand(tx, admit, sql<boolean>`true`),
	);
	equal(joined.version, 1);
	equal(joined.activeGeneration, 1);
	equal(
		await db.transaction((tx) => applyAccessMembershipCommand(tx, admit, sql<boolean>`true`)),
		joined,
	);
	const left = await db.transaction((tx) =>
		applyAccessMembershipCommand(
			tx,
			{ ...admit, operation: "leave", expectedVersion: 1, operationId: randomUUID() },
			sql<boolean>`true`,
		),
	);
	equal(left.version, 2);
	equal(left.activeGeneration, null);
	equal(left.lastGeneration, 1);
	const rejoined = await db.transaction((tx) =>
		applyAccessMembershipCommand(
			tx,
			{ ...admit, expectedVersion: 2, operationId: randomUUID() },
			sql<boolean>`true`,
		),
	);
	equal(rejoined.version, 3);
	equal(rejoined.activeGeneration, 2);
	equal(
		(
			await first.query(
				"select generation from access_membership_admission where membership_id=$1 order by generation",
				[joined.membershipId],
			)
		).rows.map((row) => row.generation),
		["1", "2"],
	);
	equal(
		(
			await first.query(
				"select exists(select 1 from access_membership where id=$1 and active_generation=1) as live",
				[joined.membershipId],
			)
		).rows[0].live,
		false,
	);
	equal(
		await db.transaction((tx) => applyAccessMembershipCommand(tx, admit, sql<boolean>`true`)),
		joined,
	);
	await assert.rejects(
		db.transaction((tx) =>
			applyAccessMembershipCommand(
				tx,
				{ ...admit, expectedVersion: 3, operationId: randomUUID() },
				sql<boolean>`true`,
			),
		),
		AccessMembershipConflict,
	);
	assertions++;
	await assert.rejects(
		db.transaction((tx) =>
			applyAccessMembershipCommand(
				tx,
				{ ...admit, operation: "leave", expectedVersion: 1, operationId: randomUUID() },
				sql<boolean>`true`,
			),
		),
		AccessMembershipConflict,
	);
	assertions++;
	await assert.rejects(
		db.transaction((tx) =>
			applyAccessMembershipCommand(tx, { ...admit, expectedVersion: 3 }, sql<boolean>`true`),
		),
		AccessMembershipConflict,
	);
	assertions++;
	await assert.rejects(
		db.transaction((tx) => applyAccessMembershipCommand(tx, admit, sql<boolean>`false`)),
		AccessMembershipAdmissionDenied,
	);
	assertions++;
	await assert.rejects(
		db.transaction((tx) => applyAccessMembershipCommand(tx, admit, sql<boolean | null>`null`)),
		AccessMembershipAdmissionUnavailable,
	);
	assertions++;
	// Entity and principal enrollments remain separate even for equal native UUIDs.
	await first.query("insert into entity_identity(id,shape) values ($1,'unknown')", [
		operatorAuthUserId,
	]);
	const entitySubject = await db.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "entity", id: operatorAuthUserId }),
	);
	const entityMember = await db.transaction((tx) =>
		applyAccessMembershipCommand(
			tx,
			{
				...admit,
				subjectId: entitySubject,
				authoritySubjectId: entitySubject,
				operationId: randomUUID(),
			},
			sql<boolean>`true`,
		),
	);
	assert.notEqual(entityMember.membershipId, joined.membershipId);
	assertions++;
	await assert.rejects(
		db.transaction((tx) =>
			applyAccessMembershipCommand(
				tx,
				{
					...admit,
					subjectId: entitySubject,
					operation: "leave",
					expectedVersion: 1,
					operationId: randomUUID(),
				},
				sql<boolean>`true`,
			),
		),
		(e: unknown) =>
			e instanceof Error &&
			"cause" in e &&
			e.cause instanceof Error &&
			"code" in e.cause &&
			e.cause.code === "23514",
	);
	assertions++;
	await db.transaction((tx) =>
		applyAccessMembershipCommand(
			tx,
			{
				...admit,
				subjectId: entitySubject,
				operation: "remove",
				expectedVersion: 1,
				operationId: randomUUID(),
			},
			sql<boolean>`true`,
		),
	);
	equal(
		(await db.transaction((tx) => readAccessMembership(tx, { scopeId, subjectId: entitySubject })))
			?.activeGeneration,
		null,
	);
	await rejected(
		"update access_membership set subject_id=$1 where id=$2",
		[entitySubject, joined.membershipId],
		"55000",
	);
	await rejected("delete from access_membership where id=$1", [joined.membershipId], "55000");
	await rejected(
		"delete from access_membership_event where membership_id=$1",
		[joined.membershipId],
		"55000",
	);
	await rejected(
		"update access_membership_admission set generation=3 where membership_id=$1 and generation=1",
		[joined.membershipId],
		"55000",
	);
	await rejected(
		"delete from access_membership_admission where membership_id=$1",
		[joined.membershipId],
		"55000",
	);
	await rejected(
		"update access_membership set version=4,active_generation=1 where id=$1",
		[joined.membershipId],
		"23514",
	);
	const emptySubject = await db.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "principal", id: operatorAuthUserId }),
	);
	const otherScope = await db.transaction((tx) => allocateAccessScope(tx, { kind: "platform" }));
	await rejected(
		"insert into access_membership(scope_id,subject_id) values ($1,$2)",
		[otherScope, emptySubject],
		"23514",
	);
	await db.transaction(async (tx) => {
		await assert.rejects(
			applyAccessMembershipCommand(
				tx,
				{ ...admit, scopeId: otherScope, operationId: randomUUID() },
				sql<boolean>`false`,
			),
			AccessMembershipAdmissionDenied,
		);
	});
	assertions++;
	equal(
		await db.transaction((tx) => readAccessMembership(tx, { scopeId: otherScope, subjectId })),
		null,
	);
	// An owner-policy denial cannot be bypassed by rejoining; actual ban policy is separately qualified.
	await db.transaction((tx) =>
		applyAccessMembershipCommand(
			tx,
			{ ...admit, operation: "leave", expectedVersion: 3, operationId: randomUUID() },
			sql<boolean>`true`,
		),
	);
	await assert.rejects(
		db.transaction((tx) =>
			applyAccessMembershipCommand(
				tx,
				{ ...admit, expectedVersion: 4, operationId: randomUUID() },
				sql<boolean>`false`,
			),
		),
		AccessMembershipAdmissionDenied,
	);
	assertions++;
	equal(
		(await db.transaction((tx) => readAccessMembership(tx, { scopeId, subjectId })))
			?.lastGeneration,
		2,
	);
	const race = { ...admit, scopeId: otherScope, operationId: randomUUID() };
	const ready = Promise.withResolvers<void>(),
		release = Promise.withResolvers<void>();
	const writer = db.transaction(async (tx) => {
		const result = await applyAccessMembershipCommand(tx, race, sql<boolean>`true`);
		ready.resolve();
		await release.promise;
		return result;
	});
	await ready.promise;
	const competing = peer.transaction((tx) =>
		applyAccessMembershipCommand(tx, race, sql<boolean>`true`),
	);
	await blocked(secondPid, firstPid);
	release.resolve();
	equal(await competing, await writer);
	for (const afterAdmission of [false, true]) {
		const expiry = (
			await first.query("select clock_timestamp()+interval '500 milliseconds' as expiry")
		).rows[0].expiry as Date;
		await first.query("begin");
		if (afterAdmission)
			await first.query("select id from users where id=$1 for update", [operatorAuthUserId]);
		else
			await first.query("select id from access_membership where id=$1 for update", [
				joined.membershipId,
			]);
		const pending = peer.transaction(async (tx) => {
			// Catch inside the outer transaction: all provisional rows must still roll back.
			await assert.rejects(
				applyAccessMembershipCommand(
					tx,
					{ ...admit, expectedVersion: 4, operationId: randomUUID() },
					sql<boolean>`clock_timestamp()<${expiry}::timestamptz`,
				),
				AccessMembershipAdmissionDenied,
			);
		});
		await blocked(secondPid, firstPid);
		if (afterAdmission) {
			const query = (
				await first.query("select query from pg_stat_activity where pid=$1", [secondPid])
			).rows[0].query;
			assert.match(query, /insert into "access_membership_event"/);
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
			(await db.transaction((tx) => readAccessMembership(tx, { scopeId, subjectId })))?.version,
			4,
		);
		equal(
			(
				await first.query(
					"select count(*)::integer as count from access_membership_event where membership_id=$1",
					[joined.membershipId],
				)
			).rows[0].count,
			4,
		);
		equal(
			(
				await first.query(
					"select count(*)::integer as count from access_membership_admission where membership_id=$1",
					[joined.membershipId],
				)
			).rows[0].count,
			2,
		);
	}

	const unavailableCommand = { ...admit, expectedVersion: 4, operationId: randomUUID() };
	await db.transaction(async (tx) => {
		await assert.rejects(
			applyAccessMembershipCommand(
				tx,
				unavailableCommand,
				sql<
					boolean | null
				>`case when exists(select 1 from public.access_membership_event where membership_id=${joined.membershipId}::uuid and operation_id=${unavailableCommand.operationId}::uuid) then null::boolean else true end`,
			),
			AccessMembershipAdmissionUnavailable,
		);
	});
	assertions++;
	equal(
		(
			await first.query(
				"select count(*)::integer as count from access_membership_event where membership_id=$1",
				[joined.membershipId],
			)
		).rows[0].count,
		4,
	);
	equal(
		(await db.transaction((tx) => readAccessMembership(tx, { scopeId, subjectId })))
			?.activeGeneration,
		null,
	);

	const sampleSeed = randomUUID();
	await first.query("begin");
	await first.query(
		`create temporary table membership_sample_ids on commit drop as
	 select overlay(overlay(md5($1||':user:'||i) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid as user_id,
	 overlay(overlay(md5($1||':subject:'||i) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid as subject_id,
	 overlay(overlay(md5($1||':membership:'||i) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid as membership_id
	 from generate_series(1,1000) i`,
		[sampleSeed],
	);
	await first.query(
		"insert into users(id,name,email) select user_id,'Membership sample',user_id::text||'@membership-sample.invalid' from membership_sample_ids",
	);
	await first.query(
		"insert into access_subject(id,auth_user_id) select subject_id,user_id from membership_sample_ids",
	);
	await first.query(
		"insert into access_membership(id,scope_id,subject_id) select membership_id,$1,subject_id from membership_sample_ids",
		[scopeId],
	);
	await first.query(
		"insert into access_membership_event(membership_id,version,operation_id,request_digest,operation,last_generation,active_generation,operator_auth_user_id,authority_subject_id) select membership_id,1,uuidv7(),repeat('0',64),'admit',1,1,$1,$2 from membership_sample_ids",
		[operatorAuthUserId, subjectId],
	);
	await first.query(
		"insert into access_membership_admission(membership_id,generation,event_version) select membership_id,1,1 from membership_sample_ids",
	);
	await first.query(
		"update access_membership set version=1,last_generation=1,active_generation=1 where id in(select membership_id from membership_sample_ids)",
	);
	const sample = (await first.query("select * from membership_sample_ids limit 1")).rows[0];
	await first.query("commit");
	// A repeatedly rejoined identity must seek exact history keys without scanning its lifetime.
	await db.transaction(async (tx) => {
		for (let version = 4; version < 104; version++)
			await applyAccessMembershipCommand(
				tx,
				{
					...admit,
					expectedVersion: version,
					operation: version % 2 === 0 ? "admit" : "leave",
					operationId: randomUUID(),
				},
				sql<boolean>`true`,
			);
	});
	await first.query(
		"analyze access_membership,access_membership_admission,access_membership_event",
	);
	const measured: unknown[] = [];
	for (const [table, where, args] of [
		["access_membership", "scope_id=$1 and subject_id=$2", [scopeId, sample.subject_id]],
		["access_membership_admission", "membership_id=$1 and generation=26", [joined.membershipId]],
		["access_membership_event", "membership_id=$1 and version=51", [joined.membershipId]],
	] as const) {
		const plan = (
			await first.query(
				`explain(analyze,buffers,format json) select * from ${table} where ${where}`,
				[...args],
			)
		).rows[0]["QUERY PLAN"];
		assert.match(JSON.stringify(plan), /Index (?:Only )?Scan/);
		assertions++;
		if (table !== "access_membership") {
			assert.equal(plan[0].Plan["Index Name"], `${table}_pkey`);
			assertions++;
		}
		const bytes = (
			await first.query(
				`select count(*)::integer as rows,avg(pg_column_size(t))::float8 as tuple_bytes,pg_table_size('${table}')::float8 as table_bytes,pg_indexes_size('${table}')::float8 as index_bytes from ${table} t`,
			)
		).rows[0];
		measured.push({ table, plan, bytes });
	}
	const root = new URL("../../../", import.meta.url),
		sourceDigests: Record<string, string> = {};
	for (const path of [
		"services/main/scripts/check-access-memberships.ts",
		"services/main/src/services/authorization/memberships.ts",
		"services/main/src/services/database/schema/access-membership.ts",
		"services/main/src/services/database/schema/postgres/access-membership.sql",
		"services/main/src/services/database/migrations/atlas.sum",
	])
		sourceDigests[path] = createHash("sha256")
			.update(await readFile(new URL(path, root)))
			.digest("hex");
	console.info(
		JSON.stringify({
			baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: fileURLToPath(root),
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
