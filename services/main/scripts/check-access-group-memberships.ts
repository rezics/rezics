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
	AccessMembershipAdmissionDenied,
} from "../src/services/authorization/memberships";
import { applyAccessGroupCommand } from "../src/services/authorization/groups";
import {
	applyAccessGroupMembershipCommand,
	readAccessGroupMemberships,
	AccessGroupMembershipConflict,
	AccessGroupMembershipAdmissionDenied,
	AccessGroupMembershipUnavailable,
	AccessGroupMembershipBudgetExceeded,
	type AccessGroupMembershipCommand,
} from "../src/services/authorization/group-memberships";
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
	throw Error("Expected Group selection contention");
}
try {
	await first.connect();
	await second.connect();
	const firstPid = (await first.query("select pg_backend_pid() as pid")).rows[0].pid,
		secondPid = (await second.query("select pg_backend_pid() as pid")).rows[0].pid;
	const operatorAuthUserId = randomUUID();
	await first.query("insert into users(id,name,email) values ($1,'Group selection fixture',$2)", [
		operatorAuthUserId,
		`${operatorAuthUserId}@group-selection.invalid`,
	]);
	const subjectId = await db.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "principal", id: operatorAuthUserId }),
	);
	const scopeId = await db.transaction((tx) =>
		allocateAccessScope(tx, { kind: "account", id: operatorAuthUserId }),
	);
	const otherScope = await db.transaction((tx) => allocateAccessScope(tx, { kind: "platform" }));
	const actor = { operatorAuthUserId, authoritySubjectId: subjectId };
	const create = async (parentId: string | null = null, scope = scopeId) =>
		await db.transaction((tx) =>
			applyAccessGroupCommand(
				tx,
				{
					operation: "create",
					scopeId: scope,
					groupId: randomUUID(),
					expectedVersion: 0,
					operationId: randomUUID(),
					parentId,
					presentation: { label: "Selection fixture Group", description: null },
					...actor,
				},
				sql<boolean>`true`,
			),
		);
	const parent = await create(),
		leaf = await create(parent.groupId),
		sibling = await create(),
		foreign = await create(null, otherScope);
	const treeBefore = (
		await first.query("select version from access_group_tree where scope_id=$1", [scopeId])
	).rows[0].version;
	const membership = await db.transaction((tx) =>
		applyAccessMembershipCommand(
			tx,
			{
				operation: "admit",
				scopeId,
				subjectId,
				expectedVersion: 0,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		),
	);
	equal(
		(await first.query("select version from access_group_tree where scope_id=$1", [scopeId]))
			.rows[0].version,
		treeBefore,
	);
	// Membership admission uses the tree-before-enrollment order and cannot leave a new set after expiry.
	const admissionExpiry = (
		await first.query("select clock_timestamp()+interval '500 milliseconds' as expiry")
	).rows[0].expiry as Date;
	await first.query("begin");
	await first.query("select scope_id from access_group_tree where scope_id=$1 for update", [
		otherScope,
	]);
	const expiringAdmission = peer.transaction(async (tx) => {
		await assert.rejects(
			applyAccessMembershipCommand(
				tx,
				{
					operation: "admit",
					scopeId: otherScope,
					subjectId,
					expectedVersion: 0,
					operationId: randomUUID(),
					...actor,
				},
				sql<boolean>`clock_timestamp()<${admissionExpiry}::timestamptz`,
			),
			AccessMembershipAdmissionDenied,
		);
	});
	await blocked(secondPid, firstPid);
	await first.query(
		"select pg_sleep(greatest(0,extract(epoch from($1::timestamptz-clock_timestamp())))+0.05)",
		[admissionExpiry],
	);
	await first.query("commit");
	await expiringAdmission;
	assertions++;
	equal(
		(
			await first.query(
				"select count(*)::integer as count from access_membership where scope_id=$1 and subject_id=$2",
				[otherScope, subjectId],
			)
		).rows[0].count,
		0,
	);
	const command = (
		groupId: string,
		generation = 1,
		expectedVersion = 0,
		operation: AccessGroupMembershipCommand["operation"] = "assign",
	): AccessGroupMembershipCommand => ({
		scopeId,
		membershipId: membership.membershipId,
		generation,
		groupId,
		expectedVersion,
		operation,
		operationId: randomUUID(),
		...actor,
	});
	const run = (input: AccessGroupMembershipCommand) =>
		db.transaction((tx) => applyAccessGroupMembershipCommand(tx, input, sql<boolean>`true`));
	const read = () =>
		db.transaction((tx) =>
			readAccessGroupMemberships(tx, { scopeId, membershipId: membership.membershipId }),
		);
	equal((await read()).setVersion, 0);
	equal((await read()).direct, []);
	const original = command(leaf.groupId),
		assigned = await run(original);
	equal(assigned.version, 1);
	equal(assigned.selectedAfter, true);
	const otherOperator = randomUUID();
	await first.query("insert into users(id,name,email) values($1,'Other selection operator',$2)", [
		otherOperator,
		`${otherOperator}@group-selection.invalid`,
	]);
	await rejected(run({ ...command(sibling.groupId), operatorAuthUserId: otherOperator }), "23514");
	await assert.rejects(
		run({ ...original, operatorAuthUserId: otherOperator }),
		AccessGroupMembershipConflict,
	);
	assertions++;

	equal(await run(original), assigned);
	let snapshot = await read();
	equal(snapshot.direct, [{ groupId: leaf.groupId, selectionVersion: 1 }]);
	equal(
		snapshot.paths.map((p) => [p.groupId, p.depth]),
		[
			[leaf.groupId, 1],
			[parent.groupId, 2],
		],
	);
	await run(command(sibling.groupId));
	await run(command(parent.groupId));
	snapshot = await read();
	equal(snapshot.direct.length, 3);
	equal(snapshot.paths.filter((p) => p.groupId === parent.groupId).length, 2);
	await run(command(leaf.groupId, 1, 1, "remove"));
	snapshot = await read();
	equal(snapshot.direct.length, 2);
	equal(
		snapshot.paths.some((p) => p.groupId === leaf.groupId),
		false,
	);
	const reassigned = await run(command(leaf.groupId, 1, 2));
	equal(reassigned.version, 3);
	equal(await run(original), assigned);
	equal((await read()).direct.find((g) => g.groupId === leaf.groupId)?.selectionVersion, 3);
	await assert.rejects(run({ ...original, expectedVersion: 3 }), AccessGroupMembershipConflict);
	assertions++;
	await assert.rejects(run(command(foreign.groupId)), AccessGroupMembershipConflict);
	assertions++;
	await assert.rejects(run(command(leaf.groupId, 99)), AccessGroupMembershipUnavailable);
	assertions++;
	await assert.rejects(run(command(leaf.groupId, 1, 3, "prune")), AccessGroupMembershipConflict);
	assertions++;
	for (const [predicate, error] of [
		[sql<boolean>`false`, AccessGroupMembershipAdmissionDenied],
		[sql<boolean | null>`null`, AccessGroupMembershipUnavailable],
	] as const) {
		await assert.rejects(
			db.transaction((tx) => applyAccessGroupMembershipCommand(tx, original, predicate)),
			error,
		);
		assertions++;
	}
	await rejected(
		first.query("delete from access_group_membership where membership_id=$1", [
			membership.membershipId,
		]),
		"55000",
	);
	await rejected(
		first.query("delete from access_group_membership_event where membership_id=$1", [
			membership.membershipId,
		]),
		"55000",
	);
	await rejected(
		first.query("delete from access_group_membership_set where membership_id=$1", [
			membership.membershipId,
		]),
		"55000",
	);
	await rejected(
		first.query("update access_group_membership set scope_id=$1 where membership_id=$2", [
			otherScope,
			membership.membershipId,
		]),
		"55000",
	);
	const bare = await create();
	await rejected(
		first.query(
			"insert into access_group_membership(membership_id,generation,group_id,scope_id) values($1,1,$2,$3)",
			[membership.membershipId, bare.groupId, scopeId],
		),
		"23514",
	);
	await db.transaction((tx) =>
		applyAccessMembershipCommand(
			tx,
			{
				operation: "leave",
				scopeId,
				subjectId,
				expectedVersion: 1,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		),
	);
	equal((await read()).generation, null);
	equal((await read()).paths, []);
	await db.transaction((tx) =>
		applyAccessMembershipCommand(
			tx,
			{
				operation: "admit",
				scopeId,
				subjectId,
				expectedVersion: 2,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		),
	);
	equal((await read()).generation, 2);
	equal((await read()).direct, []);
	equal((await read()).setVersion, 0);
	await run(command(leaf.groupId, 1, 3, "prune"));
	await assert.rejects(run(command(leaf.groupId, 1, 4)), AccessGroupMembershipConflict);
	assertions++;
	await first.query("insert into entity_identity(id,shape) values($1,'unknown')", [
		operatorAuthUserId,
	]);
	// Same UUID does not make the public Entity inherit private account eligibility.
	await first.query("insert into entity_participation(entity_id) values($1)", [operatorAuthUserId]);
	const entitySubject = await db.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "entity", id: operatorAuthUserId }),
	);
	const entityMember = await db.transaction((tx) =>
		applyAccessMembershipCommand(
			tx,
			{
				operation: "admit",
				scopeId,
				subjectId: entitySubject,
				expectedVersion: 0,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		),
	);
	await run({ ...command(leaf.groupId), membershipId: entityMember.membershipId });
	await run({ ...command(sibling.groupId), membershipId: entityMember.membershipId });
	equal(
		(
			await db.transaction((tx) =>
				readAccessGroupMemberships(tx, { scopeId, membershipId: entityMember.membershipId }),
			)
		).direct.length,
		2,
	);
	equal((await read()).direct.length, 0);
	let deepest = await create();
	for (let depth = 1; depth < 7; depth++) deepest = await create(deepest.groupId);
	const groups: Awaited<ReturnType<typeof create>>[] = [];
	for (let i = 0; i < 67; i++) groups.push(await create(deepest.groupId));
	await db.transaction(async (tx) => {
		for (const group of groups.slice(0, 64))
			await applyAccessGroupMembershipCommand(tx, command(group.groupId, 2), sql<boolean>`true`);
	});
	const overflow = command(groups[64]!.groupId, 2);
	await assert.rejects(run(overflow), AccessGroupMembershipBudgetExceeded);
	assertions++;
	equal((await read()).direct.length, 64);
	equal((await read()).paths.length, 512);
	await first.query("begin");
	await first.query(
		"insert into access_group_membership(membership_id,generation,group_id,scope_id) values($1,2,$2,$3)",
		[membership.membershipId, groups[64]!.groupId, scopeId],
	);
	await first.query(
		"insert into access_group_membership_event(membership_id,generation,group_id,version,operation_id,request_digest,operation,selected_after,operator_auth_user_id,authority_subject_id) values($1,2,$2,1,$3,repeat('0',64),'assign',true,$4,$5)",
		[membership.membershipId, groups[64]!.groupId, randomUUID(), operatorAuthUserId, subjectId],
	);
	await rejected(
		first.query(
			"update access_group_membership set version=1,selected=true where membership_id=$1 and generation=2 and group_id=$2",
			[membership.membershipId, groups[64]!.groupId],
		),
		"54000",
	);
	await first.query("rollback");

	await db.transaction((tx) =>
		applyAccessGroupCommand(
			tx,
			{
				operation: "retire",
				scopeId,
				groupId: groups[0]!.groupId,
				expectedVersion: 1,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		),
	);
	snapshot = await read();
	equal(snapshot.direct.length, 63);
	equal(snapshot.obsoleteGroupIds, [groups[0]!.groupId]);
	await assert.rejects(run(overflow), AccessGroupMembershipBudgetExceeded);
	assertions++;
	await run(command(groups[0]!.groupId, 2, 1, "prune"));
	await run(overflow);
	equal((await read()).direct.length, 64);
	await run(command(groups[1]!.groupId, 2, 1, "remove"));
	const ready = Promise.withResolvers<void>(),
		release = Promise.withResolvers<void>();
	const writer = db.transaction(async (tx) => {
		await applyAccessGroupMembershipCommand(
			tx,
			command(groups[65]!.groupId, 2),
			sql<boolean>`true`,
		);
		ready.resolve();
		await release.promise;
	});
	await ready.promise;
	const competing = peer.transaction((tx) =>
		applyAccessGroupMembershipCommand(tx, command(groups[66]!.groupId, 2), sql<boolean>`true`),
	);
	const exhausted = assert.rejects(competing, AccessGroupMembershipBudgetExceeded);
	await blocked(secondPid, firstPid);
	release.resolve();
	await writer;
	await exhausted;
	assertions++;
	equal((await read()).direct.length, 64);
	// Leave holds the enrollment fence; a waiting assignment cannot retain the departed generation.
	await run(command(groups[2]!.groupId, 2, 1, "remove"));
	const leavingReady = Promise.withResolvers<void>(),
		leaveRelease = Promise.withResolvers<void>();
	const leaving = db.transaction(async (tx) => {
		await applyAccessMembershipCommand(
			tx,
			{
				operation: "leave",
				scopeId,
				subjectId,
				expectedVersion: 3,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		);
		leavingReady.resolve();
		await leaveRelease.promise;
	});
	await leavingReady.promise;
	const joining = peer.transaction((tx) =>
		applyAccessGroupMembershipCommand(tx, command(groups[66]!.groupId, 2), sql<boolean>`true`),
	);
	const inactive = assert.rejects(joining, AccessGroupMembershipAdmissionDenied);
	await blocked(secondPid, firstPid);
	leaveRelease.resolve();
	await leaving;
	await inactive;
	assertions++;
	equal((await read()).generation, null);
	await db.transaction((tx) =>
		applyAccessMembershipCommand(
			tx,
			{
				operation: "admit",
				scopeId,
				subjectId,
				expectedVersion: 4,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		),
	);
	// The enrollment head itself stays unchanged when Group selections change; the set version detects stale RR reads.
	await rejected(
		peer.transaction(
			async (tx) => {
				await tx.execute(
					sql`select version from public.access_group_membership_set where membership_id=${membership.membershipId}::uuid and generation=3`,
				);
				await run(command(leaf.groupId, 3));
				return readAccessGroupMemberships(tx, { scopeId, membershipId: membership.membershipId });
			},
			{ isolationLevel: "repeatable read" },
		),
		"40001",
	);
	const reading = Promise.withResolvers<void>(),
		readRelease = Promise.withResolvers<void>();
	const reader = db.transaction(async (tx) => {
		const result = await readAccessGroupMemberships(tx, {
			scopeId,
			membershipId: membership.membershipId,
		});
		reading.resolve();
		await readRelease.promise;
		return result;
	});
	await reading.promise;
	const removing = peer.transaction((tx) =>
		applyAccessGroupMembershipCommand(
			tx,
			command(leaf.groupId, 3, 1, "remove"),
			sql<boolean>`true`,
		),
	);
	await blocked(secondPid, firstPid);
	readRelease.resolve();
	equal((await reader).direct.length, 1);
	await removing;
	for (const waitAt of ["tree", "member", "set", "head", "audit"]) {
		const expiry = (
			await first.query("select clock_timestamp()+interval '500 milliseconds' as expiry")
		).rows[0].expiry as Date;
		await first.query("begin");
		if (waitAt === "tree")
			await first.query("select scope_id from access_group_tree where scope_id=$1 for update", [
				scopeId,
			]);
		else if (waitAt === "member")
			await first.query("select id from access_membership where id=$1 for update", [
				membership.membershipId,
			]);
		else if (waitAt === "set")
			await first.query(
				"select membership_id from access_group_membership_set where membership_id=$1 and generation=3 for update",
				[membership.membershipId],
			);
		else if (waitAt === "head")
			await first.query(
				"select membership_id from access_group_membership where membership_id=$1 and generation=3 and group_id=$2 for update",
				[membership.membershipId, leaf.groupId],
			);
		else await first.query("select id from users where id=$1 for update", [operatorAuthUserId]);
		const pending = peer.transaction(async (tx) => {
			await assert.rejects(
				applyAccessGroupMembershipCommand(
					tx,
					command(leaf.groupId, 3, 2),
					sql<boolean>`clock_timestamp()<${expiry}::timestamptz`,
				),
				AccessGroupMembershipAdmissionDenied,
			);
		});
		await blocked(secondPid, firstPid);
		if (waitAt === "audit") {
			assert.match(
				(await first.query("select query from pg_stat_activity where pid=$1", [secondPid])).rows[0]
					.query,
				/insert into "access_group_membership_event"/,
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
		equal((await read()).direct.length, 0);
		equal((await read()).setVersion, 2);
	}
	const unavailable = command(leaf.groupId, 3, 2);
	await db.transaction(async (tx) => {
		await assert.rejects(
			applyAccessGroupMembershipCommand(
				tx,
				unavailable,
				sql<
					boolean | null
				>`case when exists(select 1 from public.access_group_membership_event where membership_id=${membership.membershipId}::uuid and generation=3 and group_id=${leaf.groupId}::uuid and operation_id=${unavailable.operationId}::uuid) then null::boolean else true end`,
			),
			AccessGroupMembershipUnavailable,
		);
	});
	assertions++;
	equal((await read()).setVersion, 2);
	await db.transaction((tx) =>
		applyAccessGroupMembershipCommand(
			tx,
			command(leaf.groupId, 3, 2),
			sql<boolean>`exists(select 1 from public.access_group_membership_set where membership_id=${membership.membershipId}::uuid and generation=3 and version=2)`,
		),
	);
	equal((await read()).setVersion, 3);
	// A missing current set is unavailable, never an empty proof. Corruption is confined to a rolled-back fixture transaction.
	const rollbackFault = new Error("Roll back missing-set fixture corruption");
	await assert.rejects(
		db.transaction(async (tx) => {
			await tx.execute(sql`set local session_replication_role='replica'`);
			await tx.execute(
				sql`delete from public.access_group_membership_set where membership_id=${membership.membershipId}::uuid and generation=3`,
			);
			await assert.rejects(
				readAccessGroupMemberships(tx, { scopeId, membershipId: membership.membershipId }),
				AccessGroupMembershipUnavailable,
			);
			assertions++;
			throw rollbackFault;
		}),
		(error) => error === rollbackFault,
	);
	equal((await read()).setVersion, 3);

	const doomed = await create();
	await rejected(
		db.transaction(async (tx) => {
			await tx.execute(
				sql`insert into public.access_group_membership(membership_id,generation,group_id,scope_id) values(${membership.membershipId}::uuid,3,${doomed.groupId}::uuid,${scopeId}::uuid)`,
			);
			await tx.execute(
				sql`insert into public.access_group_membership_event(membership_id,generation,group_id,version,operation_id,request_digest,operation,selected_after,operator_auth_user_id,authority_subject_id) values(${membership.membershipId}::uuid,3,${doomed.groupId}::uuid,1,${randomUUID()}::uuid,repeat('0',64),'assign',true,${operatorAuthUserId}::uuid,${subjectId}::uuid)`,
			);
			await applyAccessGroupCommand(
				tx,
				{
					operation: "retire",
					scopeId,
					groupId: doomed.groupId,
					expectedVersion: 1,
					operationId: randomUUID(),
					...actor,
				},
				sql<boolean>`true`,
			);
			await tx.execute(
				sql`update public.access_group_membership set version=1,selected=true where membership_id=${membership.membershipId}::uuid and generation=3 and group_id=${doomed.groupId}::uuid`,
			);
		}),
		"23514",
	);
	const pathReady = Promise.withResolvers<void>(),
		pathRelease = Promise.withResolvers<void>();
	const pathRead = db.transaction(async (tx) => {
		const value = await readAccessGroupMemberships(tx, {
			scopeId,
			membershipId: entityMember.membershipId,
		});
		pathReady.resolve();
		await pathRelease.promise;
		return value;
	});
	await pathReady.promise;
	const reparenting = peer.transaction((tx) =>
		applyAccessGroupCommand(
			tx,
			{
				operation: "reparent",
				scopeId,
				groupId: leaf.groupId,
				parentId: sibling.groupId,
				expectedVersion: 1,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		),
	);
	await blocked(secondPid, firstPid);
	pathRelease.resolve();
	equal(
		(await pathRead).paths.some((p) => p.groupId === parent.groupId),
		true,
	);
	await reparenting;
	const moved = await db.transaction((tx) =>
		readAccessGroupMemberships(tx, { scopeId, membershipId: entityMember.membershipId }),
	);
	equal(
		moved.paths.some((p) => p.groupId === parent.groupId),
		false,
	);
	equal(moved.paths.filter((p) => p.groupId === sibling.groupId).length, 2);
	await run(command(doomed.groupId, 3));
	const retireReady = Promise.withResolvers<void>(),
		retireRelease = Promise.withResolvers<void>();
	const retiring = db.transaction(async (tx) => {
		await applyAccessGroupCommand(
			tx,
			{
				operation: "retire",
				scopeId,
				groupId: doomed.groupId,
				expectedVersion: 1,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		);
		retireReady.resolve();
		await retireRelease.promise;
	});
	await retireReady.promise;
	const retiredAssignment = peer.transaction((tx) =>
		applyAccessGroupMembershipCommand(
			tx,
			{ ...command(doomed.groupId), membershipId: entityMember.membershipId },
			sql<boolean>`true`,
		),
	);
	const retired = assert.rejects(retiredAssignment, AccessGroupMembershipConflict);
	await blocked(secondPid, firstPid);
	retireRelease.resolve();
	await retiring;
	await retired;
	assertions++;
	equal((await read()).obsoleteGroupIds, [doomed.groupId]);
	await run(command(doomed.groupId, 3, 1, "prune"));
	// Long history on one selection must retain exact event seeks.
	await db.transaction(async (tx) => {
		for (let version = 3; version < 103; version++)
			await applyAccessGroupMembershipCommand(
				tx,
				command(leaf.groupId, 3, version, version % 2 === 1 ? "remove" : "assign"),
				sql<boolean>`true`,
			);
	});
	const sampleSeed = randomUUID();
	await first.query("begin");
	await first.query(
		`create temporary table group_membership_sample on commit drop as select overlay(overlay(md5($1||':user:'||i) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid as user_id,overlay(overlay(md5($1||':subject:'||i) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid as subject_id,overlay(overlay(md5($1||':member:'||i) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid as member_id from generate_series(1,1000)i`,
		[sampleSeed],
	);
	await first.query(
		"insert into users(id,name,email) select user_id,'Group sample',user_id::text||'@group-member-sample.invalid' from group_membership_sample",
	);
	await first.query(
		"insert into access_subject(id,auth_user_id) select subject_id,user_id from group_membership_sample",
	);
	await first.query(
		"insert into access_membership(id,scope_id,subject_id) select member_id,$1,subject_id from group_membership_sample",
		[scopeId],
	);
	await first.query(
		"insert into access_membership_event(membership_id,version,operation_id,request_digest,operation,last_generation,active_generation,operator_auth_user_id,authority_subject_id) select member_id,1,uuidv7(),repeat('0',64),'admit',1,1,$1,$2 from group_membership_sample",
		[operatorAuthUserId, subjectId],
	);
	await first.query(
		"insert into access_membership_admission(membership_id,generation,event_version) select member_id,1,1 from group_membership_sample",
	);
	await first.query(
		"update access_membership set version=1,last_generation=1,active_generation=1 where id in(select member_id from group_membership_sample)",
	);
	await first.query(
		"insert into access_group_membership(membership_id,generation,group_id,scope_id) select member_id,1,$1,$2 from group_membership_sample",
		[leaf.groupId, scopeId],
	);
	await first.query(
		"insert into access_group_membership_event(membership_id,generation,group_id,version,operation_id,request_digest,operation,selected_after,operator_auth_user_id,authority_subject_id) select member_id,1,$1,1,uuidv7(),repeat('0',64),'assign',true,$2,$3 from group_membership_sample",
		[leaf.groupId, operatorAuthUserId, subjectId],
	);
	await first.query(
		"update access_group_membership set version=1,selected=true where membership_id in(select member_id from group_membership_sample)",
	);
	const sample = (
		await first.query("select member_id from group_membership_sample order by member_id limit 1")
	).rows[0].member_id;
	await first.query("commit");
	await first.query(
		"analyze access_group_membership,access_group_membership_event,access_group_membership_set",
	);
	const measured: unknown[] = [];
	for (const [table, index, query, args] of [
		[
			"access_group_membership_set",
			"access_group_membership_set_pkey",
			"select * from access_group_membership_set where membership_id=$1 and generation=3",
			[membership.membershipId],
		],
		[
			"access_group_membership",
			"access_group_membership_selected_idx",
			"select group_id from access_group_membership where membership_id=$1 and generation=2 and selected limit 65",
			[membership.membershipId],
		],
		[
			"access_group_membership",
			"access_group_membership_roster_idx",
			"select membership_id,generation from access_group_membership where group_id=$1 and selected and (membership_id,generation)>($2::uuid,1) order by membership_id,generation limit 100",
			[leaf.groupId, sample],
		],
		[
			"access_group_membership_event",
			"access_group_membership_event_pkey",
			"select * from access_group_membership_event where membership_id=$1 and generation=3 and group_id=$2 and version=51",
			[membership.membershipId, leaf.groupId],
		],
	] as const) {
		const plan = (await first.query(`explain(analyze,buffers,format json) ${query}`, [...args]))
			.rows[0]["QUERY PLAN"];
		if (table === "access_group_membership_set") {
			assert.match(plan[0].Plan["Index Name"], /^access_group_membership_set_(?:pkey|scope_key)$/);
			assert.match(plan[0].Plan["Index Cond"], /membership_id =/);
			assert.match(plan[0].Plan["Index Cond"], /generation = 3/);
			equal(plan[0].Plan["Actual Rows"], 1);
		} else
			assert.ok(
				JSON.stringify(plan).includes(index),
				`${table}: expected ${index}: ${JSON.stringify(plan)}`,
			);
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
		"services/main/scripts/check-access-group-memberships.ts",
		"services/main/src/services/authorization/group-memberships.ts",
		"services/main/src/services/authorization/memberships.ts",
		"libraries/schema/src/postgres/access/access-group-membership.ts",
		"services/main/src/services/database/schema/postgres/access-group-membership.sql",
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
