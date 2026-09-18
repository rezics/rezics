import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { accessPermissionKey, type AccessPermission, type UnitPermission } from "@rezics/access";
import type { DatabaseTransaction } from "../src/services/database";
import {
	allocateAccessScope,
	allocateAccessSubject,
} from "../src/services/authorization/identities";
import {
	applyAccessRoleCommand as persistRole,
	readAccessRoleSnapshot,
	AccessRoleConflict,
	type AccessRoleCommand,
	AccessRoleAdmissionDenied,
	AccessRoleAdmissionUnavailable,
} from "../src/services/authorization/roles";

const unit = (key: UnitPermission): AccessPermission => ({ family: "unit", key });
// SQL-admin fixture admission isolates storage; it does not qualify management authorization.
const applyAccessRoleCommand = (tx: DatabaseTransaction, command: AccessRoleCommand) =>
	persistRole(tx, command, sql<boolean>`true`);

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
const equal = (actual: unknown, expected: unknown) => {
	assert.deepEqual(actual, expected);
	assertions++;
};
async function rejected(query: string, values: unknown[], code: string) {
	await assert.rejects(
		first.query(query, values),
		(e: unknown) => e instanceof Error && "code" in e && e.code === code,
	);
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
	throw Error("Expected role head contention");
}
try {
	await first.connect();
	await second.connect();
	const firstPid = (await first.query("select pg_backend_pid() as pid")).rows[0].pid,
		secondPid = (await second.query("select pg_backend_pid() as pid")).rows[0].pid;
	const operatorAuthUserId = randomUUID();
	await first.query("insert into users(id,name,email) values ($1,'Role fixture',$2)", [
		operatorAuthUserId,
		`${operatorAuthUserId}@role-fixture.invalid`,
	]);
	const authoritySubjectId = await db.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "principal", id: operatorAuthUserId }),
	);
	const scopeId = await db.transaction((tx) =>
		allocateAccessScope(tx, { kind: "account", id: operatorAuthUserId }),
	);
	const otherScope = await db.transaction((tx) => allocateAccessScope(tx, { kind: "platform" }));
	const actor = { operatorAuthUserId, authoritySubjectId };
	const roleId = randomUUID();
	const definition = {
		label: "Editor",
		description: null,
		permissions: [unit("unit.read")] as const,
	};
	const create = {
		operation: "create" as const,
		roleId,
		scopeId,
		expectedVersion: 0,
		operationId: randomUUID(),
		...actor,
		definition,
	};
	const created = await db.transaction((tx) => applyAccessRoleCommand(tx, create));
	equal(created.version, 1);
	equal(created.state, "draft");
	equal(created.activeRevision, null);
	equal(
		await db.transaction((tx) =>
			readAccessRoleSnapshot(tx, { scopeId, roleId, revision: "active" }),
		),
		null,
	);
	equal(
		(await db.transaction((tx) => readAccessRoleSnapshot(tx, { scopeId, roleId, revision: 1 })))
			?.permissions,
		[unit("unit.read")],
	);
	equal(await db.transaction((tx) => applyAccessRoleCommand(tx, create)), created);
	await assert.rejects(
		db.transaction((tx) =>
			applyAccessRoleCommand(tx, {
				...create,
				definition: { ...definition, label: "Changed intent" },
			}),
		),
		AccessRoleConflict,
	);
	assertions++;
	await db.transaction((tx) =>
		applyAccessRoleCommand(tx, {
			operation: "activate",
			scopeId,
			roleId,
			expectedVersion: 1,
			operationId: randomUUID(),
			...actor,
			definitionRevision: 1,
		}),
	);
	equal(
		(
			await db.transaction((tx) =>
				readAccessRoleSnapshot(tx, { scopeId, roleId, revision: "active" }),
			)
		)?.permissions,
		[unit("unit.read")],
	);
	const proposed = await db.transaction((tx) =>
		applyAccessRoleCommand(tx, {
			operation: "revise",
			scopeId,
			roleId,
			expectedVersion: 2,
			operationId: randomUUID(),
			...actor,
			definition: { ...definition, permissions: [unit("unit.update"), unit("unit.read")] },
		}),
	);
	equal(
		await db.transaction((tx) =>
			applyAccessRoleCommand(tx, {
				operation: "revise",
				scopeId,
				roleId,
				expectedVersion: 2,
				operationId: proposed.operationId,
				...actor,
				definition: { ...definition, permissions: [unit("unit.read"), unit("unit.update")] },
			}),
		),
		proposed,
	);
	equal(proposed.version, 3);
	equal(proposed.activeRevision, 1);
	equal(
		(
			await db.transaction((tx) =>
				readAccessRoleSnapshot(tx, { scopeId, roleId, revision: "active" }),
			)
		)?.permissions,
		[unit("unit.read")],
	);
	const activated = await db.transaction((tx) =>
		applyAccessRoleCommand(tx, {
			operation: "activate",
			scopeId,
			roleId,
			expectedVersion: 3,
			operationId: randomUUID(),
			...actor,
			definitionRevision: 3,
		}),
	);
	equal(activated.version, 4);
	equal(
		(
			await db.transaction((tx) =>
				readAccessRoleSnapshot(tx, { scopeId, roleId, revision: "active" }),
			)
		)?.permissions,
		[unit("unit.read"), unit("unit.update")],
	);
	await assert.rejects(
		db.transaction((tx) =>
			applyAccessRoleCommand(tx, {
				operation: "retire",
				scopeId,
				roleId,
				expectedVersion: 2,
				operationId: randomUUID(),
				...actor,
			}),
		),
		AccessRoleConflict,
	);
	assertions++;
	const retired = await db.transaction((tx) =>
		applyAccessRoleCommand(tx, {
			operation: "retire",
			scopeId,
			roleId,
			expectedVersion: 4,
			operationId: randomUUID(),
			...actor,
		}),
	);
	equal(retired.state, "retired");
	equal(retired.activeRevision, 3);
	equal(
		await db.transaction((tx) =>
			readAccessRoleSnapshot(tx, { scopeId, roleId, revision: "active" }),
		),
		null,
	);
	equal(
		(await db.transaction((tx) => readAccessRoleSnapshot(tx, { scopeId, roleId, revision: 1 })))
			?.label,
		"Editor",
	);
	equal(await db.transaction((tx) => applyAccessRoleCommand(tx, create)), created);
	await assert.rejects(
		db.transaction((tx) =>
			applyAccessRoleCommand(tx, {
				operation: "activate",
				scopeId,
				roleId,
				expectedVersion: 5,
				operationId: randomUUID(),
				...actor,
				definitionRevision: 1,
			}),
		),
		AccessRoleConflict,
	);
	assertions++;
	equal(
		await db.transaction((tx) =>
			readAccessRoleSnapshot(tx, { scopeId: otherScope, roleId, revision: 1 }),
		),
		null,
	);
	await assert.rejects(
		db.transaction((tx) => applyAccessRoleCommand(tx, { ...create, scopeId: otherScope })),
		AccessRoleConflict,
	);
	assertions++;
	for (const [query, values, code] of [
		["insert into access_role(scope_id) values ($1)", [scopeId], "23514"],
		["insert into access_role(scope_id) values ($1)", [randomUUID()], "23503"],
		["update access_role set scope_id=$1 where id=$2", [otherScope, roleId], "55000"],
		["delete from access_role where id=$1", [roleId], "55000"],
		["update access_role_revision set label='rewritten' where role_id=$1", [roleId], "55000"],
		["delete from access_role_revision where role_id=$1", [roleId], "55000"],
		[
			"update access_role_event set request_digest=repeat('0',64) where role_id=$1",
			[roleId],
			"55000",
		],
		["delete from access_role_event where role_id=$1", [roleId], "55000"],
		[
			"insert into access_role_permission(role_id,revision,family,permission) values ($1,1,'unit','unit.update')",
			[roleId],
			"55000",
		],
		["delete from access_role_permission where role_id=$1", [roleId], "55000"],
	] as const)
		await rejected(query, [...values], code);
	const raw = randomUUID(),
		digest = createHash("sha256").update("unit:unit.read\nunit:unit.update").digest("hex");
	await first.query("begin");
	await first.query("insert into access_role(id,scope_id) values ($1,$2)", [raw, scopeId]);
	await first.query(
		"insert into access_role_event(role_id,version,operation_id,request_digest,operation,state_after,operator_auth_user_id,authority_subject_id) values ($1,1,$2,repeat('0',64),'create','draft',$3,$4)",
		[raw, randomUUID(), operatorAuthUserId, authoritySubjectId],
	);

	for (const [label, description] of [
		["", null],
		["   ", null],
		["x".repeat(513), null],
		["Valid", "x".repeat(4097)],
	] as const) {
		await first.query("savepoint invalid_definition");
		await rejected(
			"insert into access_role_revision(role_id,revision,label,description,permission_count,permission_digest) values ($1,1,$2,$3,2,$4)",
			[raw, label, description, digest],
			"23514",
		);
		await first.query("rollback to invalid_definition");
	}
	await first.query(
		"insert into access_role_revision(role_id,revision,label,permission_count,permission_digest) values ($1,1,'Complete snapshot',2,$2)",
		[raw, digest],
	);
	for (const [family, permission] of [
		["unit", "unknown.permission"],
		["unit", "*"],
		["unit", "platform.access.manage"],
		["platform", "unit.read"],
		["management", "realm.members.manage"],
		["unregistered", "unit.read"],
	]) {
		await first.query("savepoint rejected_case");
		await rejected(
			"insert into access_role_permission(role_id,revision,family,permission) values ($1,1,$2,$3)",
			[raw, family, permission],
			"23514",
		);
		await first.query("rollback to rejected_case");
	}
	await first.query(
		"insert into access_role_permission(role_id,revision,family,permission) values ($1,1,'unit','unit.read')",
		[raw],
	);
	await first.query("savepoint incomplete");
	await rejected("update access_role_revision set sealed=true where role_id=$1", [raw], "23514");
	await first.query("rollback to incomplete");
	await first.query("savepoint wrong_permission_set");
	await first.query(
		"insert into access_role_permission(role_id,revision,family,permission) values ($1,1,'platform','realm.members.manage')",
		[raw],
	);
	await rejected("update access_role_revision set sealed=true where role_id=$1", [raw], "23514");
	await first.query("rollback to wrong_permission_set");
	await first.query("savepoint duplicate_permission");
	await rejected(
		"insert into access_role_permission(role_id,revision,family,permission) values ($1,1,'unit','unit.read')",
		[raw],
		"23505",
	);
	await first.query("rollback to duplicate_permission");
	await first.query(
		"insert into access_role_permission(role_id,revision,family,permission) values ($1,1,'unit','unit.update')",
		[raw],
	);
	await first.query("update access_role_revision set sealed=true where role_id=$1", [raw]);
	await first.query("update access_role set version=1 where id=$1", [raw]);
	await first.query("commit");
	equal(
		(
			await db.transaction((tx) =>
				readAccessRoleSnapshot(tx, { scopeId, roleId: raw, revision: 1 }),
			)
		)?.permissions,
		[unit("unit.read"), unit("unit.update")],
	);
	// An event and unsealed definition cannot survive a partially completed command.
	const incompleteRole = randomUUID();
	await first.query("begin");
	await first.query("insert into access_role(id,scope_id) values ($1,$2)", [
		incompleteRole,
		scopeId,
	]);
	await first.query(
		"insert into access_role_event(role_id,version,operation_id,request_digest,operation,state_after,operator_auth_user_id,authority_subject_id) values ($1,1,$2,repeat('0',64),'create','draft',$3,$4)",
		[incompleteRole, randomUUID(), operatorAuthUserId, authoritySubjectId],
	);
	await first.query(
		"insert into access_role_revision(role_id,revision,label,permission_count,permission_digest) values ($1,1,'Incomplete',0,$2)",
		[incompleteRole, createHash("sha256").update("").digest("hex")],
	);
	await first.query("update access_role set version=1 where id=$1", [incompleteRole]);
	await rejected("commit", [], "23514");
	equal(
		(await first.query("select id from access_role where id=$1", [incompleteRole])).rowCount,
		0,
	);
	for (const sameCommand of [true, false]) {
		const id = randomUUID();
		await db.transaction((tx) =>
			applyAccessRoleCommand(tx, { ...create, roleId: id, operationId: randomUUID() }),
		);
		const command = {
			operation: "revise" as const,
			scopeId,
			roleId: id,
			expectedVersion: 1,
			operationId: randomUUID(),
			...actor,
			definition: { ...definition, label: "Concurrent revision" },
		};
		const ready = Promise.withResolvers<void>(),
			release = Promise.withResolvers<void>();
		const firstWrite = db.transaction(async (tx) => {
			const result = await applyAccessRoleCommand(tx, command);
			ready.resolve();
			await release.promise;
			return result;
		});
		await ready.promise;
		const other = peer.transaction((tx) =>
			applyAccessRoleCommand(tx, sameCommand ? command : { ...command, operationId: randomUUID() }),
		);
		const rejection = sameCommand ? undefined : assert.rejects(other, AccessRoleConflict);
		await blocked(secondPid, firstPid);
		release.resolve();
		const winner = await firstWrite;
		if (sameCommand) equal(await other, winner);
		else {
			await rejection;
			assertions++;
		}
		equal(
			(
				await first.query(
					"select count(*)::integer as count from access_role_event where role_id=$1",
					[id],
				)
			).rows[0].count,
			2,
		);
	}

	const gateRoleId = randomUUID();
	await db.transaction((tx) =>
		applyAccessRoleCommand(tx, { ...create, roleId: gateRoleId, operationId: randomUUID() }),
	);
	const gateCommand = {
		operation: "revise" as const,
		roleId: gateRoleId,
		scopeId,
		expectedVersion: 1,
		operationId: randomUUID(),
		...actor,
		definition: { ...definition, permissions: [unit("unit.read"), unit("unit.update")] as const },
	};
	await assert.rejects(
		db.transaction((tx) => persistRole(tx, gateCommand, sql<boolean>`false`)),
		AccessRoleAdmissionDenied,
	);
	assertions++;
	await assert.rejects(
		db.transaction((tx) => persistRole(tx, gateCommand, sql<boolean | null>`null`)),
		AccessRoleAdmissionUnavailable,
	);
	assertions++;
	await assert.rejects(
		db.transaction((tx) =>
			persistRole(
				tx,
				gateCommand,
				sql<boolean>`exists(select 1 from public.access_role_permission where role_id=${gateRoleId}::uuid and family='unit' and permission='unit.update')`,
			),
		),
		AccessRoleAdmissionDenied,
	);
	assertions++;
	// The caller can catch a denied command and commit unrelated work: its savepoint rolls back.
	await db.transaction(async (tx) => {
		await assert.rejects(
			persistRole(tx, gateCommand, sql<boolean>`false`),
			AccessRoleAdmissionDenied,
		);
	});
	assertions++;
	equal(
		(
			await first.query(
				"select count(*)::integer as count from access_role_event where role_id=$1",
				[gateRoleId],
			)
		).rows[0].count,
		1,
	);
	for (const waitAfterAdmission of [false, true]) {
		const deadline = (
			await first.query("select clock_timestamp()+interval '500 milliseconds' as deadline")
		).rows[0].deadline as Date;
		await first.query("begin");
		if (waitAfterAdmission)
			await first.query("select id from users where id=$1 for update", [operatorAuthUserId]);
		else await first.query("select id from access_role where id=$1 for update", [gateRoleId]);
		const pending = peer.transaction((tx) =>
			persistRole(tx, gateCommand, sql<boolean>`clock_timestamp()<${deadline}::timestamptz`),
		);
		const denied = assert.rejects(pending, AccessRoleAdmissionDenied);
		await blocked(secondPid, firstPid);
		if (waitAfterAdmission) {
			const query = (
				await first.query("select query from pg_stat_activity where pid=$1", [secondPid])
			).rows[0].query;
			assert.match(query, /insert into "access_role_event"/);
			assertions++;
		}
		await first.query(
			"select pg_sleep(greatest(0,extract(epoch from ($1::timestamptz-clock_timestamp())))+0.05)",
			[deadline],
		);
		await first.query("commit");
		await denied;
		assertions++;
		equal(
			(await first.query("select version from access_role where id=$1", [gateRoleId])).rows[0]
				.version,
			"1",
		);
		equal(
			(
				await first.query(
					"select count(*)::integer as count from access_role_revision where role_id=$1",
					[gateRoleId],
				)
			).rows[0].count,
			1,
		);
	}
	// Active reads serialize a competing retirement rather than returning a head that changed midway.
	await db.transaction((tx) =>
		applyAccessRoleCommand(tx, {
			operation: "activate",
			scopeId,
			roleId: gateRoleId,
			expectedVersion: 1,
			operationId: randomUUID(),
			...actor,
			definitionRevision: 1,
		}),
	);
	const reading = Promise.withResolvers<void>(),
		finishRead = Promise.withResolvers<void>();
	const reader = db.transaction(async (tx) => {
		const snapshot = await readAccessRoleSnapshot(tx, {
			scopeId,
			roleId: gateRoleId,
			revision: "active",
		});
		reading.resolve();
		await finishRead.promise;
		return snapshot;
	});
	await reading.promise;
	const retirement = peer.transaction((tx) =>
		applyAccessRoleCommand(tx, {
			operation: "retire",
			scopeId,
			roleId: gateRoleId,
			expectedVersion: 2,
			operationId: randomUUID(),
			...actor,
		}),
	);
	await blocked(secondPid, firstPid);
	finishRead.resolve();
	equal((await reader)?.revision, 1);
	await retirement;
	equal(
		await db.transaction((tx) =>
			readAccessRoleSnapshot(tx, { scopeId, roleId: gateRoleId, revision: "active" }),
		),
		null,
	);

	const qualifiedRoleId = randomUUID();
	await db.transaction((tx) =>
		applyAccessRoleCommand(tx, {
			...create,
			roleId: qualifiedRoleId,
			operationId: randomUUID(),
			definition: {
				...definition,
				permissions: [
					{ family: "unit", key: "realm.members.manage" },
					{ family: "platform", key: "realm.members.manage" },
				],
			},
		}),
	);
	const qualified = await db.transaction((tx) =>
		readAccessRoleSnapshot(tx, { scopeId, roleId: qualifiedRoleId, revision: 1 }),
	);
	equal(qualified?.permissions.map(accessPermissionKey), [
		"platform:realm.members.manage",
		"unit:realm.members.manage",
	]);

	const otherActor = randomUUID();
	await first.query("insert into users(id,name,email) values ($1,'Other role actor',$2)", [
		otherActor,
		`${otherActor}@role-fixture.invalid`,
	]);
	const otherSubject = await db.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "principal", id: otherActor }),
	);
	await assert.rejects(
		db.transaction((tx) =>
			applyAccessRoleCommand(tx, {
				...create,
				roleId: randomUUID(),
				operationId: randomUUID(),
				authoritySubjectId: otherSubject,
			}),
		),
		(error: unknown) =>
			error instanceof Error &&
			"cause" in error &&
			error.cause instanceof Error &&
			"code" in error.cause &&
			error.cause.code === "23514",
	);
	assertions++;
	const sampleSeed = randomUUID();
	await first.query("begin");
	await first.query(
		`insert into access_role(id,scope_id) select overlay(overlay(md5($1||i::text) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid,$2 from generate_series(1,1000) i`,
		[sampleSeed, scopeId],
	);
	await first.query(
		`insert into access_role_event(role_id,version,operation_id,request_digest,operation,state_after,operator_auth_user_id,authority_subject_id)
	 select overlay(overlay(md5($1||i::text) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid,1,uuidv7(),repeat('0',64),'create','draft',$2,$3 from generate_series(1,1000) i`,
		[sampleSeed, operatorAuthUserId, authoritySubjectId],
	);
	await first.query(
		`insert into access_role_revision(role_id,revision,label,permission_count,permission_digest)
	 select overlay(overlay(md5($1||i::text) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid,1,'Role sample',2,$2 from generate_series(1,1000) i`,
		[sampleSeed, digest],
	);
	await first.query(
		`insert into access_role_permission(role_id,revision,family,permission)
	 select overlay(overlay(md5($1||i::text) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid,1,'unit',p from generate_series(1,1000) i cross join unnest(array['unit.read','unit.update']) p`,
		[sampleSeed],
	);
	await first.query(
		`update access_role_revision set sealed=true where role_id in (select overlay(overlay(md5($1||i::text) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid from generate_series(1,1000) i)`,
		[sampleSeed],
	);
	await first.query(
		`update access_role set version=1 where id in (select overlay(overlay(md5($1||i::text) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid from generate_series(1,1000) i)`,
		[sampleSeed],
	);
	await first.query("commit");
	const measured: unknown[] = [];

	// A long-lived role needs exact version seeks, not just a selective role prefix.
	const sampleRole = randomUUID();
	await db.transaction((tx) =>
		applyAccessRoleCommand(tx, { ...create, roleId: sampleRole, operationId: randomUUID() }),
	);
	await db.transaction(async (tx) => {
		for (let version = 1; version <= 100; version++)
			await applyAccessRoleCommand(tx, {
				operation: "revise",
				scopeId,
				roleId: sampleRole,
				expectedVersion: version,
				operationId: randomUUID(),
				...actor,
				definition: { ...definition, permissions: [unit("unit.read"), unit("unit.update")] },
			});
	});
	await first.query(
		"analyze access_role,access_role_revision,access_role_permission,access_role_event",
	);
	for (const [table, index, where] of [
		["access_role_revision", "access_role_revision_pkey", "role_id=$1 and revision=51"],
		[
			"access_role_permission",
			"access_role_permission_pkey",
			"role_id=$1 and revision=51 and family='unit' and permission='unit.read'",
		],
		["access_role_event", "access_role_event_pkey", "role_id=$1 and version=51"],
	] as const) {
		const plan = (
			await first.query(
				`explain(analyze,buffers,format json) select * from ${table} where ${where}`,
				[sampleRole],
			)
		).rows[0]["QUERY PLAN"];
		assert.ok(JSON.stringify(plan).includes(index));
		assertions++;
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
		"libraries/access/src/management.ts",
		"services/main/scripts/check-access-roles.ts",
		"services/main/src/services/authorization/roles.ts",
		"services/main/src/services/authorization/permission.ts",
		"libraries/schema/src/postgres/access/access-role.ts",
		"services/main/src/services/database/schema/postgres/access-role.sql",
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
