import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { constrainAccessPermissions, accessPermissionKey } from "@rezics/access";
import {
	allocateAccessScope,
	allocateAccessSubject,
} from "../src/services/authorization/identities";
import {
	applyAccessRoleCommand,
	readAccessRoleSnapshot,
} from "../src/services/authorization/roles";
import { applyAccessGroupCommand } from "../src/services/authorization/groups";
import {
	applyAccessRoleBindingCommand,
	readAccessRoleBindingSnapshot,
	AccessRoleBindingConflict,
	AccessRoleBindingAdmissionDenied,
	AccessRoleBindingUnavailable,
	type AccessRoleBindingCommand,
} from "../src/services/authorization/role-bindings";
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
	throw Error("Expected binding contention");
}
try {
	await first.connect();
	await second.connect();
	const firstPid = (await first.query("select pg_backend_pid() as pid")).rows[0].pid,
		secondPid = (await second.query("select pg_backend_pid() as pid")).rows[0].pid;
	const operatorAuthUserId = randomUUID();
	await first.query("insert into users(id,name,email) values($1,'Binding fixture',$2)", [
		operatorAuthUserId,
		`${operatorAuthUserId}@binding.invalid`,
	]);
	const subjectId = await db.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "principal", id: operatorAuthUserId }),
	);
	const scopeId = await db.transaction((tx) =>
		allocateAccessScope(tx, { kind: "account", id: operatorAuthUserId }),
	);
	const otherScope = await db.transaction((tx) => allocateAccessScope(tx, { kind: "platform" }));
	const actor = { operatorAuthUserId, authoritySubjectId: subjectId };
	equal(
		(
			await first.query("select version from access_role_binding_scope where scope_id=$1", [
				scopeId,
			])
		).rows[0].version,
		"0",
	);
	const roleId = randomUUID();
	const roleCreate = {
		operation: "create" as const,
		scopeId,
		roleId,
		expectedVersion: 0,
		operationId: randomUUID(),
		...actor,
		definition: {
			label: "Binding role",
			description: null,
			permissions: [{ family: "unit" as const, key: "unit.read" as const }],
		},
	};
	await db.transaction((tx) => applyAccessRoleCommand(tx, roleCreate, sql<boolean>`true`));
	await db.transaction((tx) =>
		applyAccessRoleCommand(
			tx,
			{
				operation: "activate",
				scopeId,
				roleId,
				expectedVersion: 1,
				operationId: randomUUID(),
				definitionRevision: 1,
				...actor,
			},
			sql<boolean>`true`,
		),
	);
	const groupId = randomUUID();
	await db.transaction((tx) =>
		applyAccessGroupCommand(
			tx,
			{
				operation: "create",
				scopeId,
				groupId,
				parentId: null,
				expectedVersion: 0,
				operationId: randomUUID(),
				presentation: { label: "Binding Group", description: null },
				...actor,
			},
			sql<boolean>`true`,
		),
	);
	const from = new Date("2020-01-01T00:00:00Z"),
		until = new Date("2030-01-01T00:00:00Z");
	const terms = {
		targetPath: [] as string[],
		validFrom: from,
		validUntil: until,
		permissionPolicy: { mode: "local-role" as const },
	};
	const create = (
		recipient: Extract<AccessRoleBindingCommand, { operation: "create" }>["recipient"] = {
			kind: "subject",
			subjectId,
		},
		targetScopeId = scopeId,
	): Extract<AccessRoleBindingCommand, { operation: "create" }> => ({
		operation: "create",
		targetScopeId,
		bindingId: randomUUID(),
		roleId,
		recipient,
		terms,
		expectedVersion: 0,
		operationId: randomUUID(),
		...actor,
	});
	const run = (command: AccessRoleBindingCommand) =>
		db.transaction((tx) => applyAccessRoleBindingCommand(tx, command, sql<boolean>`true`));
	const initial = create(),
		bound = await run(initial);
	equal(bound.version, 1);
	equal(bound.termsRevision, 1);
	equal(await run(initial), bound);
	const read = (
		bindingId = bound.bindingId,
		revision: number | "current" = "current",
		targetScopeId = scopeId,
	) =>
		db.transaction((tx) =>
			readAccessRoleBindingSnapshot(tx, { targetScopeId, bindingId, revision }),
		);
	equal((await read())?.recipient, { kind: "subject", subjectId });
	equal((await read())?.terms.permissionPolicy, { mode: "local-role" });
	const groupBinding = await run(create({ kind: "group", groupId, scopeId }));
	equal((await read(groupBinding.bindingId))?.recipient, { kind: "group", groupId, scopeId });
	const members = await run(create({ kind: "all-members", scopeId }));
	equal((await read(members.bindingId))?.recipient, { kind: "all-members", scopeId });
	await first.query("insert into entity_identity(id,shape) values($1,'unknown')", [
		operatorAuthUserId,
	]);
	const entitySubject = await db.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "entity", id: operatorAuthUserId }),
	);
	const discardReservation = new Error("Discard the reserved-identity fixture");
	await assert.rejects(
		db.transaction(async (tx) => {
			const bindingId = randomUUID();
			await tx.execute(
				sql`insert into public.access_role_binding(id,target_scope_id,role_id,recipient_kind,recipient_subject_id) values(${bindingId}::uuid,${scopeId}::uuid,${roleId}::uuid,'subject',${subjectId}::uuid)`,
			);
			await assert.rejects(
				applyAccessRoleBindingCommand(
					tx,
					{ ...create({ kind: "subject", subjectId: entitySubject }), bindingId },
					sql<boolean>`true`,
				),
				AccessRoleBindingConflict,
			);
			assertions++;
			throw discardReservation;
		}),
		(error) => error === discardReservation,
	);
	const entity = await run(create({ kind: "subject", subjectId: entitySubject }));
	equal((await read(entity.bindingId))?.recipient, { kind: "subject", subjectId: entitySubject });
	await db.transaction((tx) =>
		applyAccessGroupCommand(
			tx,
			{
				operation: "create",
				scopeId: otherScope,
				groupId: randomUUID(),
				parentId: null,
				expectedVersion: 0,
				operationId: randomUUID(),
				presentation: { label: "Foreign recipient namespace", description: null },
				...actor,
			},
			sql<boolean>`true`,
		),
	);
	await assert.rejects(
		run(create({ kind: "group", groupId, scopeId: randomUUID() })),
		AccessRoleBindingConflict,
	);
	assertions++;
	await assert.rejects(
		run(create({ kind: "subject", subjectId: randomUUID() })),
		AccessRoleBindingConflict,
	);
	assertions++;
	await assert.rejects(
		run({
			...create({ kind: "all-members", scopeId: randomUUID() }),
			terms: { ...terms, permissionPolicy: { mode: "frozen-ceiling", permissions: [] } },
		}),
		AccessRoleBindingConflict,
	);
	assertions++;
	await assert.rejects(
		run(create({ kind: "group", groupId, scopeId: otherScope })),
		AccessRoleBindingConflict,
	);
	assertions++;
	await assert.rejects(
		run(create({ kind: "subject", subjectId }, otherScope)),
		AccessRoleBindingConflict,
	);
	assertions++;
	await assert.rejects(
		run(create({ kind: "all-members", scopeId: otherScope })),
		AccessRoleBindingConflict,
	);
	assertions++;
	const foreignMembers = await run({
		...create({ kind: "all-members", scopeId: otherScope }),
		terms: {
			...terms,
			permissionPolicy: {
				mode: "frozen-ceiling",
				permissions: [{ family: "unit", key: "unit.read" }],
			},
		},
	});
	equal((await read(foreignMembers.bindingId))?.recipient, {
		kind: "all-members",
		scopeId: otherScope,
	});
	const frozen = create({ kind: "subject", subjectId }, otherScope);
	frozen.terms = {
		...terms,
		targetPath: ["chapters"],
		permissionPolicy: {
			mode: "frozen-ceiling",
			permissions: [
				{ family: "unit", key: "unit.update" },
				{ family: "unit", key: "unit.read" },
			],
		},
	};
	const external = await run(frozen);
	equal((await read(external.bindingId, "current", otherScope))?.terms.targetPath, ["chapters"]);
	equal(
		(await read(external.bindingId, "current", otherScope))?.terms.permissionPolicy,
		frozen.terms.permissionPolicy.mode === "frozen-ceiling"
			? {
					mode: "frozen-ceiling",
					permissions: [
						{ family: "unit", key: "unit.read" },
						{ family: "unit", key: "unit.update" },
					],
				}
			: null,
	);
	const amend: AccessRoleBindingCommand = {
		operation: "amend",
		targetScopeId: scopeId,
		bindingId: bound.bindingId,
		expectedVersion: 1,
		operationId: randomUUID(),
		...actor,
		terms: { ...terms, targetPath: ["chapters", "notes"], validUntil: null },
	};
	await run(amend);
	equal((await read())?.terms.targetPath, ["chapters", "notes"]);
	equal((await read(bound.bindingId, 1))?.terms.targetPath, []);
	equal((await read())?.terms.validUntil, null);
	equal(await run(initial), bound);
	await assert.rejects(run({ ...initial, expectedVersion: 2 }), AccessRoleBindingConflict);
	assertions++;
	equal(await read(bound.bindingId, "current", otherScope), null);
	await rejected(
		first.query("update access_role_binding set target_scope_id=$1 where id=$2", [
			otherScope,
			bound.bindingId,
		]),
		"55000",
	);
	await rejected(
		first.query("delete from access_role_binding where id=$1", [bound.bindingId]),
		"55000",
	);
	await rejected(
		first.query("delete from access_role_binding_event where binding_id=$1", [bound.bindingId]),
		"55000",
	);
	await rejected(
		first.query(
			"update access_role_binding_revision set valid_until=null where binding_id=$1 and revision=1",
			[bound.bindingId],
		),
		"55000",
	);
	await rejected(
		first.query(
			"insert into access_role_binding_permission(binding_id,revision,family,permission) values($1,1,'unit','unit.read')",
			[bound.bindingId],
		),
		"55000",
	);
	await rejected(
		first.query("delete from access_role_binding_permission where binding_id=$1", [
			external.bindingId,
		]),
		"55000",
	);
	await rejected(
		first.query(
			"insert into access_role_binding(target_scope_id,role_id,recipient_kind,recipient_subject_id) values($1,$2,'subject',$3)",
			[scopeId, roleId, subjectId],
		),
		"23514",
	);
	const broken = randomUUID();
	await first.query("begin");
	await first.query(
		"insert into access_role_binding(id,target_scope_id,role_id,recipient_kind,recipient_subject_id) values($1,$2,$3,'subject',$4)",
		[broken, scopeId, roleId, subjectId],
	);
	await first.query(
		"insert into access_role_binding_event(binding_id,version,operation_id,request_digest,operation,operator_auth_user_id,authority_subject_id) values($1,1,$2,repeat('0',64),'create',$3,$4)",
		[broken, randomUUID(), operatorAuthUserId, subjectId],
	);
	await first.query("savepoint invalid_path_bounds");
	await rejected(
		first.query(
			"insert into access_role_binding_revision(binding_id,revision,target_path,valid_from,permission_policy,permission_count,permission_digest) values($1,1,'[0:0]={a}'::text[],$2,'frozen-ceiling',1,repeat('0',64))",
			[broken, from],
		),
		"23514",
	);
	await first.query("rollback to savepoint invalid_path_bounds");
	await first.query(
		"insert into access_role_binding_revision(binding_id,revision,target_path,valid_from,permission_policy,permission_count,permission_digest) values($1,1,'{}',$2,'frozen-ceiling',1,repeat('0',64))",
		[broken, from],
	);
	await first.query("savepoint invalid_permission");
	await rejected(
		first.query(
			"insert into access_role_binding_permission(binding_id,revision,family,permission) values($1,1,'unit','*')",
			[broken],
		),
		"23514",
	);
	await first.query("rollback to savepoint invalid_permission");
	await rejected(
		first.query("update access_role_binding_revision set sealed=true where binding_id=$1", [
			broken,
		]),
		"23514",
	);
	await first.query("rollback");
	await first.query("begin");
	await first.query(
		"insert into access_role_binding_event(binding_id,version,operation_id,request_digest,operation,operator_auth_user_id,authority_subject_id) values($1,3,$2,repeat('0',64),'amend',$3,$4)",
		[bound.bindingId, randomUUID(), operatorAuthUserId, subjectId],
	);
	await rejected(first.query("commit"), "23514");
	const revoke: AccessRoleBindingCommand = {
		operation: "revoke",
		targetScopeId: scopeId,
		bindingId: bound.bindingId,
		expectedVersion: 2,
		operationId: randomUUID(),
		...actor,
	};
	const revoked = await run(revoke);
	equal(revoked.state, "revoked");
	equal(revoked.termsRevision, 2);
	equal((await read())?.state, "revoked");
	equal(await run(initial), bound);
	await assert.rejects(
		run({ ...amend, expectedVersion: 3, operationId: randomUUID() }),
		AccessRoleBindingConflict,
	);
	assertions++;
	const otherOperator = randomUUID();
	await first.query("insert into users(id,name,email) values($1,'Other binding operator',$2)", [
		otherOperator,
		`${otherOperator}@binding.invalid`,
	]);
	await rejected(run({ ...create(), operatorAuthUserId: otherOperator }), "23514");
	await assert.rejects(
		run({ ...initial, operatorAuthUserId: otherOperator }),
		AccessRoleBindingConflict,
	);
	assertions++;
	for (const invalid of [
		{ ...terms, validUntil: from },
		{ ...terms, validFrom: new Date(NaN) },
		{ ...terms, targetPath: ["bad/path"] },
		{ ...terms, targetPath: Array(9).fill("a") },
		{ ...terms, targetPath: ["a".repeat(257)] },
	]) {
		await assert.rejects(run({ ...create(), terms: invalid }));
		assertions++;
	}
	const maxPath = Array(8).fill("a".repeat(256));
	const maximum = await run({ ...create(), terms: { ...terms, targetPath: maxPath } });
	equal((await read(maximum.bindingId))?.terms.targetPath, maxPath);
	const empty = await run({
		...create({ kind: "subject", subjectId }, otherScope),
		terms: { ...terms, permissionPolicy: { mode: "frozen-ceiling", permissions: [] } },
	});
	equal((await read(empty.bindingId, "current", otherScope))?.terms.permissionPolicy, {
		mode: "frozen-ceiling",
		permissions: [],
	});
	for (const [predicate, error] of [
		[sql<boolean>`false`, AccessRoleBindingAdmissionDenied],
		[sql<boolean | null>`null`, AccessRoleBindingUnavailable],
	] as const) {
		await assert.rejects(
			db.transaction((tx) => applyAccessRoleBindingCommand(tx, initial, predicate)),
			error,
		);
		assertions++;
	}
	const gate = await run(create());
	const gateCommand: AccessRoleBindingCommand = {
		...amend,
		bindingId: gate.bindingId,
		operationId: randomUUID(),
	};
	for (const waitAt of ["scope", "role", "binding", "audit"]) {
		const expiry = (
			await first.query("select clock_timestamp()+interval '500 milliseconds' as expiry")
		).rows[0].expiry as Date;
		await first.query("begin");
		if (waitAt === "scope")
			await first.query(
				"select scope_id from access_role_binding_scope where scope_id=$1 for update",
				[scopeId],
			);
		else if (waitAt === "role")
			await first.query("select id from access_role where id=$1 for update", [roleId]);
		else if (waitAt === "binding")
			await first.query("select id from access_role_binding where id=$1 for update", [
				gate.bindingId,
			]);
		else await first.query("select id from users where id=$1 for update", [operatorAuthUserId]);
		const pending = peer.transaction(async (tx) => {
			await assert.rejects(
				applyAccessRoleBindingCommand(
					tx,
					gateCommand,
					sql<boolean>`clock_timestamp()<${expiry}::timestamptz`,
				),
				AccessRoleBindingAdmissionDenied,
			);
		});
		await blocked(secondPid, firstPid);
		if (waitAt === "audit") {
			assert.match(
				(await first.query("select query from pg_stat_activity where pid=$1", [secondPid])).rows[0]
					.query,
				/insert into "access_role_binding_event"/,
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
		equal((await read(gate.bindingId))?.version, 1);
		equal(
			(
				await first.query(
					"select count(*)::integer as count from access_role_binding_event where binding_id=$1",
					[gate.bindingId],
				)
			).rows[0].count,
			1,
		);
	}
	const scopeVersion = (
		await first.query("select version from access_role_binding_scope where scope_id=$1", [scopeId])
	).rows[0].version;
	await db.transaction(async (tx) => {
		await assert.rejects(
			applyAccessRoleBindingCommand(
				tx,
				gateCommand,
				sql<
					boolean | null
				>`case when exists(select 1 from public.access_role_binding_event where binding_id=${gate.bindingId}::uuid and version=2) then null::boolean else true end`,
			),
			AccessRoleBindingUnavailable,
		);
	});
	assertions++;
	equal(
		(
			await first.query("select version from access_role_binding_scope where scope_id=$1", [
				scopeId,
			])
		).rows[0].version,
		scopeVersion,
	);
	await db.transaction((tx) =>
		applyAccessRoleBindingCommand(
			tx,
			gateCommand,
			sql<boolean>`exists(select 1 from public.access_role_binding_scope where scope_id=${scopeId}::uuid and version=${scopeVersion}::bigint)`,
		),
	);
	equal((await read(gate.bindingId))?.version, 2);
	const race = create();
	const ready = Promise.withResolvers<void>(),
		release = Promise.withResolvers<void>();
	const writer = db.transaction(async (tx) => {
		const result = await applyAccessRoleBindingCommand(tx, race, sql<boolean>`true`);
		ready.resolve();
		await release.promise;
		return result;
	});
	await ready.promise;
	const competitor = peer.transaction((tx) =>
		applyAccessRoleBindingCommand(tx, race, sql<boolean>`true`),
	);
	await blocked(secondPid, firstPid);
	release.resolve();
	equal(await competitor, await writer);
	const reading = Promise.withResolvers<void>(),
		readRelease = Promise.withResolvers<void>();
	const reader = db.transaction(async (tx) => {
		const result = await readAccessRoleBindingSnapshot(tx, {
			targetScopeId: scopeId,
			bindingId: gate.bindingId,
			revision: "current",
		});
		reading.resolve();
		await readRelease.promise;
		return result;
	});
	await reading.promise;
	const revoking = peer.transaction((tx) =>
		applyAccessRoleBindingCommand(
			tx,
			{ ...revoke, bindingId: gate.bindingId, operationId: randomUUID() },
			sql<boolean>`true`,
		),
	);
	await blocked(secondPid, firstPid);
	readRelease.resolve();
	equal((await reader)?.state, "active");
	await revoking;
	await rejected(
		peer.transaction(
			async (tx) => {
				await tx.execute(
					sql`select version from public.access_role_binding_scope where scope_id=${scopeId}::uuid`,
				);
				await run(create());
				return readAccessRoleBindingSnapshot(tx, {
					targetScopeId: scopeId,
					bindingId: gate.bindingId,
					revision: "current",
				});
			},
			{ isolationLevel: "repeatable read" },
		),
		"40001",
	);
	await db.transaction((tx) =>
		applyAccessRoleCommand(
			tx,
			{
				operation: "revise",
				scopeId,
				roleId,
				expectedVersion: 2,
				operationId: randomUUID(),
				...actor,
				definition: {
					label: "Expanded binding role",
					description: null,
					permissions: [
						{ family: "unit", key: "unit.read" },
						{ family: "unit", key: "unit.update" },
						{ family: "management", key: "access.role-binding.manage" },
					],
				},
			},
			sql<boolean>`true`,
		),
	);
	await db.transaction((tx) =>
		applyAccessRoleCommand(
			tx,
			{
				operation: "activate",
				scopeId,
				roleId,
				expectedVersion: 3,
				definitionRevision: 3,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		),
	);
	const clipped = await db.transaction(async (tx) => {
		const binding = await readAccessRoleBindingSnapshot(tx, {
			targetScopeId: otherScope,
			bindingId: external.bindingId,
			revision: "current",
		});
		const role = await readAccessRoleSnapshot(tx, { scopeId, roleId, revision: "active" });
		assert.ok(binding && role && binding.terms.permissionPolicy.mode === "frozen-ceiling");
		return constrainAccessPermissions(
			role.permissions,
			binding.terms.permissionPolicy.permissions,
		).map(accessPermissionKey);
	});
	equal(clipped, ["unit:unit.read", "unit:unit.update"]);
	equal((await read(groupBinding.bindingId))?.terms.permissionPolicy, { mode: "local-role" });
	// A role that retires while binding creation waits cannot be used after that wait.
	const retiringRole = randomUUID();
	await db.transaction((tx) =>
		applyAccessRoleCommand(
			tx,
			{ ...roleCreate, roleId: retiringRole, operationId: randomUUID() },
			sql<boolean>`true`,
		),
	);
	await db.transaction((tx) =>
		applyAccessRoleCommand(
			tx,
			{
				operation: "activate",
				scopeId,
				roleId: retiringRole,
				expectedVersion: 1,
				definitionRevision: 1,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		),
	);
	const retireReady = Promise.withResolvers<void>(),
		retireRelease = Promise.withResolvers<void>();
	const roleRetirement = db.transaction(async (tx) => {
		await applyAccessRoleCommand(
			tx,
			{
				operation: "retire",
				scopeId,
				roleId: retiringRole,
				expectedVersion: 2,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		);
		retireReady.resolve();
		await retireRelease.promise;
	});
	await retireReady.promise;
	const waitingBinding = peer.transaction((tx) =>
		applyAccessRoleBindingCommand(tx, { ...create(), roleId: retiringRole }, sql<boolean>`true`),
	);
	const deniedRetirement = assert.rejects(waitingBinding, AccessRoleBindingConflict);
	await blocked(secondPid, firstPid);
	retireRelease.resolve();
	await roleRetirement;
	await deniedRetirement;
	assertions++;
	// A recipient Group retirement likewise wins before a later binding effect.
	const retiringGroup = randomUUID();
	await db.transaction((tx) =>
		applyAccessGroupCommand(
			tx,
			{
				operation: "create",
				scopeId,
				groupId: retiringGroup,
				parentId: null,
				expectedVersion: 0,
				operationId: randomUUID(),
				presentation: { label: "Retiring binding recipient", description: null },
				...actor,
			},
			sql<boolean>`true`,
		),
	);
	const groupReady = Promise.withResolvers<void>(),
		groupRelease = Promise.withResolvers<void>();
	const groupRetirement = db.transaction(async (tx) => {
		await applyAccessGroupCommand(
			tx,
			{
				operation: "retire",
				scopeId,
				groupId: retiringGroup,
				expectedVersion: 1,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		);
		groupReady.resolve();
		await groupRelease.promise;
	});
	await groupReady.promise;
	const waitingRecipient = peer.transaction((tx) =>
		applyAccessRoleBindingCommand(
			tx,
			create({ kind: "group", groupId: retiringGroup, scopeId }),
			sql<boolean>`true`,
		),
	);
	const deniedRecipient = assert.rejects(waitingRecipient, AccessRoleBindingConflict);
	await blocked(secondPid, firstPid);
	groupRelease.resolve();
	await groupRetirement;
	await deniedRecipient;
	assertions++;
	const sampleScopes = [scopeId];
	for (let i = 0; i < 9; i++) {
		const id = randomUUID();
		await first.query("insert into users(id,name,email) values($1,'Binding sample scope',$2)", [
			id,
			`${id}@binding-scope.invalid`,
		]);
		sampleScopes.push(
			await db.transaction((tx) => allocateAccessScope(tx, { kind: "account", id })),
		);
	}
	const sampleSeed = randomUUID();
	await db.transaction(async (tx) => {
		for (let i = 0; i < 1000; i++) {
			const hex = createHash("sha256").update(`${sampleSeed}:${i}`).digest("hex");
			const sampleId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
			await applyAccessRoleBindingCommand(
				tx,
				{
					...create(),
					bindingId: sampleId,
					targetScopeId: sampleScopes[i % sampleScopes.length]!,
					terms: {
						...terms,
						permissionPolicy: {
							mode: "frozen-ceiling",
							permissions: [{ family: "unit", key: "unit.read" }],
						},
					},
				},
				sql<boolean>`true`,
			);
		}
	});
	const hot = await run(create());
	await db.transaction(async (tx) => {
		for (let version = 1; version <= 100; version++)
			await applyAccessRoleBindingCommand(
				tx,
				{
					...amend,
					bindingId: hot.bindingId,
					expectedVersion: version,
					operationId: randomUUID(),
					terms: { ...terms, targetPath: [`section-${version}`] },
				},
				sql<boolean>`true`,
			);
	});
	await first.query(
		"analyze access_role_binding,access_role_binding_event,access_role_binding_revision,access_role_binding_permission",
	);
	const measured: unknown[] = [];
	for (const [table, index, query, args] of [
		[
			"access_role_binding",
			"access_role_binding_target_idx",
			"select id from access_role_binding where target_scope_id=$1 and id>$2 order by id limit 100",
			[scopeId, "00000000-0000-0000-0000-000000000000"],
		],
		[
			"access_role_binding_revision",
			"access_role_binding_revision_pkey",
			"select * from access_role_binding_revision where binding_id=$1 and revision=51",
			[hot.bindingId],
		],
		[
			"access_role_binding_event",
			"access_role_binding_event_pkey",
			"select * from access_role_binding_event where binding_id=$1 and version=51",
			[hot.bindingId],
		],
		[
			"access_role_binding_permission",
			"access_role_binding_permission_pkey",
			"select * from access_role_binding_permission where binding_id=$1 and revision=1 and family='unit' and permission='unit.read'",
			[external.bindingId],
		],
	] as const) {
		const plan = (await first.query(`explain(analyze,buffers,format json) ${query}`, [...args]))
			.rows[0]["QUERY PLAN"];
		assert.ok(JSON.stringify(plan).includes(index), JSON.stringify(plan));
		assertions++;
		const bytes = (
			await first.query(
				`select count(*)::integer as rows,avg(pg_column_size(t))::float8 as tuple_bytes,pg_table_size('${table}')::float8 as table_bytes,pg_indexes_size('${table}')::float8 as index_bytes from ${table} t`,
			)
		).rows[0];
		measured.push({ table, plan, bytes });
	}
	measured.push({
		table: "access_role_binding_scope",
		bytes: (
			await first.query(
				"select count(*)::integer as rows,avg(pg_column_size(t))::float8 as tuple_bytes,pg_table_size('access_role_binding_scope')::float8 as table_bytes,pg_indexes_size('access_role_binding_scope')::float8 as index_bytes from access_role_binding_scope t",
			)
		).rows[0],
	});
	const roleReadReady = Promise.withResolvers<void>(),
		roleReadRelease = Promise.withResolvers<void>();
	const bindingReader = db.transaction(async (tx) => {
		const result = await readAccessRoleBindingSnapshot(tx, {
			targetScopeId: scopeId,
			bindingId: hot.bindingId,
			revision: "current",
		});
		roleReadReady.resolve();
		await roleReadRelease.promise;
		return result;
	});
	await roleReadReady.promise;
	const finalRetirement = peer.transaction((tx) =>
		applyAccessRoleCommand(
			tx,
			{
				operation: "retire",
				scopeId,
				roleId,
				expectedVersion: 4,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		),
	);
	await blocked(secondPid, firstPid);
	roleReadRelease.resolve();
	equal((await bindingReader)?.roleState, "active");
	await finalRetirement;
	await assert.rejects(run(create()), AccessRoleBindingConflict);
	assertions++;
	equal((await read(hot.bindingId))?.roleState, "retired");
	const root = new URL("../../../", import.meta.url),
		sourceDigests: Record<string, string> = {};
	for (const path of [
		"services/main/scripts/check-access-role-bindings.ts",
		"services/main/src/services/authorization/role-bindings.ts",
		"services/main/src/services/database/schema/access-role-binding.ts",
		"services/main/src/services/database/schema/postgres/access-role-binding.sql",
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
