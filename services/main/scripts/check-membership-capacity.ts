import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { setTimeout } from "node:timers/promises";
import { and, eq, sql } from "drizzle-orm";
import { database, type DatabaseTransaction } from "../src/services/database";
import { users } from "@rezics/schema/postgres/identity/auth";
import { organizationEnrollmentInvitation as invitations } from "@rezics/schema/postgres/access/organization-membership";
import { PrincipalRequestContext } from "../src/services/auth/principal-context";
import {
	assertNativeEnrollmentFixture,
	createFixtureSessionContext,
} from "./native-enrollment-fixture";
import { createAccountIdentity } from "../src/services/authorization/create-account-identity";
import { allocateAccessSubject } from "../src/services/authorization/identities";
import { createNativeOrganization } from "../src/services/participation/organization-control";
import {
	cancelMembershipInvitation,
	inviteOrganizationMember,
} from "../src/services/participation/membership";
import { OrganizationMembershipCapacityExceeded } from "../src/services/participation/membership-contracts";

assertNativeEnrollmentFixture();
let checks = 0;
function check(actual: unknown, expected: unknown, message: string) {
	assert.deepEqual(actual, expected, message);
	checks++;
}
async function actor() {
	return database.transaction(async (tx) => {
		const [account] = await tx
			.insert(users)
			.values({
				name: "Private capacity owner",
				email: `${randomUUID()}@capacity.invalid`,
				emailVerified: true,
			})
			.returning();
		assert.ok(account);
		return { account, context: await createFixtureSessionContext(tx, account.id), hasMain: false };
	});
}
type Actor = Awaited<ReturnType<typeof actor>>;
async function recipient(owner: Actor) {
	const identity = await createAccountIdentity(owner.context, {
		operationId: randomUUID(),
		names: [],
		main: owner.hasMain ? null : { expectedVersion: 0 },
	});
	owner.hasMain = true;
	return {
		entityId: identity.entityId,
		subjectId: await database.transaction((tx) =>
			allocateAccessSubject(tx, { kind: "entity", id: identity.entityId }),
		),
	};
}
type Recipient = Awaited<ReturnType<typeof recipient>>;
async function organization(owner: Actor) {
	const created = await createNativeOrganization(owner.context, {
		name: "Native pending-capacity Org",
		language: "en",
	});
	// A real newly stored session keeps setup duration separate from fresh-session admission.
	// Existing invitation evidence retains its original still-valid session.
	const fresh = await database.transaction((tx) =>
		createFixtureSessionContext(tx, owner.account.id),
	);
	return {
		...created,
		context: new PrincipalRequestContext(
			owner.account.id,
			{
				mode: "represented",
				entityId: created.entityId,
				representations: [created.representation],
			},
			fresh.credentialProof(),
		),
	};
}
type Org = Awaited<ReturnType<typeof organization>>;
async function renewManager(org: Org) {
	const fresh = await database.transaction((tx) =>
		createFixtureSessionContext(tx, org.context.principalId),
	);
	org.context = new PrincipalRequestContext(
		fresh.principalId,
		org.context.selection,
		fresh.credentialProof(),
	);
}
function invitationInput(target: Recipient, expiresAt?: Date) {
	return {
		operationId: randomUUID(),
		recipient: { kind: "entity" as const, entityId: target.entityId },
		...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
	};
}
async function invite(org: Org, target: Recipient, expiresAt?: Date) {
	const input = invitationInput(target, expiresAt);
	const receipt = await database.transaction((tx) =>
		inviteOrganizationMember(tx, org.context, org.entityId, input),
	);
	assert.ok(receipt.invitationId);
	return { input, receipt: { ...receipt, invitationId: receipt.invitationId } };
}
async function revoke(org: Org, id: string, expectedRevision = 1) {
	await database.transaction((tx) =>
		cancelMembershipInvitation(tx, org.context, org.entityId, id, {
			operationId: randomUUID(),
			expectedRevision,
		}),
	);
}
async function pendingCount(target: { scopeId: string } | { subjectId: string }) {
	const predicate =
		"scopeId" in target
			? eq(invitations.scopeId, target.scopeId)
			: eq(invitations.recipientSubjectId, target.subjectId);
	return (
		await database.execute<{ count: number }>(
			sql`select count(*)::integer as count from ${invitations} where ${predicate} and ${invitations.state}='pending'`,
		)
	).rows[0]?.count;
}
async function sqlCapacity(work: (tx: DatabaseTransaction) => Promise<unknown>, message: string) {
	await assert.rejects(database.transaction(work), (cause: unknown) => {
		while (cause instanceof Error && cause.cause) cause = cause.cause;
		return (
			cause instanceof Error &&
			"code" in cause &&
			cause.code === "54000" &&
			cause.message === message
		);
	});
	checks++;
}
const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
		max: 3,
		statement_timeout: 20000,
	}),
	raceDb = drizzle({ client: pool });
async function fillLastSlot(
	first: (tx: DatabaseTransaction) => Promise<unknown>,
	second: (tx: DatabaseTransaction) => Promise<unknown>,
) {
	const ready = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>(),
		started = Promise.withResolvers<number>();
	const holder = raceDb.transaction(async (tx) => {
		await first(tx);
		ready.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void holder.catch(ready.reject);
	const holderPid = await ready.promise;
	const contender = raceDb.transaction(async (tx) => {
		started.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return second(tx);
	});
	void contender.catch(started.reject);
	const denied = assert.rejects(contender, OrganizationMembershipCapacityExceeded);
	void denied.catch(() => {});
	try {
		const pid = await started.promise;
		let blocked = false;
		for (let i = 0; i < 500; i++) {
			if (
				(
					await pool.query<{ blocked: boolean }>(
						"select $2::integer=any(pg_blocking_pids($1)) as blocked",
						[pid, holderPid],
					)
				).rows[0]?.blocked
			) {
				blocked = true;
				break;
			}
			await setTimeout(10);
		}
		check(blocked, true, "last-slot contender waits for the exact winner");
	} finally {
		release.resolve();
		await holder;
		await denied;
		checks++;
	}
}
try {
	const owner = await actor(),
		org = await organization(owner),
		guests: Recipient[] = [];
	for (let i = 0; i < 1002; i++) guests.push(await recipient(owner));
	await renewManager(org);
	const first = await invite(org, guests[0]!);
	for (let i = 1; i < 1000; i++) await invite(org, guests[i]!);
	check(await pendingCount(org), 1000, "Org admits its exact pending limit");
	check(
		await database.transaction((tx) =>
			inviteOrganizationMember(tx, org.context, org.entityId, first.input),
		),
		first.receipt,
		"same operation receipt replays at full capacity",
	);
	await assert.rejects(() => invite(org, guests[1000]!), OrganizationMembershipCapacityExceeded);
	checks++;
	const [template] = await database
		.select()
		.from(invitations)
		.where(eq(invitations.id, first.receipt.invitationId));
	assert.ok(template);
	await sqlCapacity(
		(tx) =>
			tx
				.insert(invitations)
				.values({ ...template, id: randomUUID(), recipientSubjectId: guests[1000]!.subjectId }),
		"Org pending invitation budget exceeded",
	);
	await revoke(org, template.id);
	const deadline = new Date(Date.now() + 2000),
		short = await invite(org, guests[1000]!, deadline);
	check(await pendingCount(org), 1000, "revocation frees exactly one Org slot");
	let expired = false;
	for (let i = 0; i < 500; i++) {
		expired =
			(
				await database.execute<{ expired: boolean }>(
					sql`select clock_timestamp()>${deadline}::timestamptz+interval '25 milliseconds' as expired`,
				)
			).rows[0]?.expired ?? false;
		if (expired) break;
		await setTimeout(10);
	}
	assert.ok(expired, "database clock crossed invitation expiry");
	await invite(org, guests[1001]!);
	check(await pendingCount(org), 1000, "admission reclaims the expired slot");
	const [terminal] = await database
		.select()
		.from(invitations)
		.where(eq(invitations.id, short.receipt.invitationId));
	check(
		[terminal?.state, terminal?.revision, terminal?.authority],
		["expired", 2, null],
		"expiry preserves a terminal identity and scrubs source evidence",
	);

	const recipientOwner = await actor(),
		target = await recipient(recipientOwner),
		owners = await Promise.all([actor(), actor(), actor(), actor()]);
	const sources = new Map<string, Org>();
	let firstInbox: { org: Org; id: string } | undefined;
	for (let i = 0; i < 1000; i++) {
		const source = await organization(owners[Math.floor(i / 250)]!);
		sources.set(source.entityId, source);
		const created = await invite(source, target);
		firstInbox ??= { org: source, id: created.receipt.invitationId };
		if ((i + 1) % 250 === 0)
			console.info(`Prepared ${i + 1} native source Orgs for recipient capacity`);
	}
	assert.ok(firstInbox);
	const overflow = await organization(owners[0]!);
	sources.set(overflow.entityId, overflow);
	await assert.rejects(() => invite(overflow, target), OrganizationMembershipCapacityExceeded);
	checks++;
	check(await pendingCount(target), 1000, "recipient subject has its independent pending limit");
	// Capture genuine proof for the overflow Org before testing the SQL capacity guard.
	const probe = await invite(overflow, guests[0]!);
	const [inboxTemplate] = await database
		.select()
		.from(invitations)
		.where(eq(invitations.id, probe.receipt.invitationId));
	assert.ok(inboxTemplate);
	await sqlCapacity(
		(tx) =>
			tx
				.insert(invitations)
				.values({ ...inboxTemplate, id: randomUUID(), recipientSubjectId: target.subjectId }),
		"Recipient pending invitation budget exceeded",
	);
	await renewManager(firstInbox.org);
	await revoke(firstInbox.org, firstInbox.id);
	await invite(overflow, target);
	check(await pendingCount(target), 1000, "recipient revocation frees exactly one inbox slot");

	await renewManager(org);
	const [pendingOrg] = await database
		.select()
		.from(invitations)
		.where(and(eq(invitations.scopeId, org.scopeId), eq(invitations.state, "pending")))
		.limit(1);
	assert.ok(pendingOrg);
	await revoke(org, pendingOrg.id);
	const firstGuest = await recipient(recipientOwner),
		secondGuest = await recipient(recipientOwner);
	await fillLastSlot(
		(tx) => inviteOrganizationMember(tx, org.context, org.entityId, invitationInput(firstGuest)),
		(tx) => inviteOrganizationMember(tx, org.context, org.entityId, invitationInput(secondGuest)),
	);
	check(await pendingCount(org), 1000, "concurrent Org admissions cannot exceed the last slot");
	const [pendingInbox] = await database
		.select()
		.from(invitations)
		.where(
			and(eq(invitations.recipientSubjectId, target.subjectId), eq(invitations.state, "pending")),
		)
		.limit(1);
	assert.ok(pendingInbox);
	const issuer = sources.get(pendingInbox.organizationEntityId);
	assert.ok(issuer);
	await renewManager(issuer);
	await revoke(issuer, pendingInbox.id);
	const firstOrg = await organization(owners[0]!),
		secondOrg = await organization(owners[0]!);
	await fillLastSlot(
		(tx) =>
			inviteOrganizationMember(tx, firstOrg.context, firstOrg.entityId, invitationInput(target)),
		(tx) =>
			inviteOrganizationMember(tx, secondOrg.context, secondOrg.entityId, invitationInput(target)),
	);
	check(await pendingCount(target), 1000, "competing Orgs cannot exceed the recipient's last slot");
	const root = new URL("../../../", import.meta.url),
		sourceDigests: Record<string, string> = {};
	for (const path of [
		"services/main/scripts/check-membership-capacity.ts",
		"services/main/scripts/native-enrollment-fixture.ts",
		"services/main/src/services/participation/membership.ts",
		"services/main/src/services/participation/organization-control.ts",
		"services/main/src/services/authorization/create-account-identity.ts",
		"libraries/schema/src/postgres/access/organization-membership.ts",
		"services/main/src/services/database/schema/postgres/organization-membership.sql",
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
			runtime: (
				await database.execute(
					sql`select version() as postgres,current_setting('default_transaction_isolation') as default_isolation`,
				)
			).rows[0],
			checks,
			organizationPendingLimit: 1000,
			recipientPendingLimit: 1000,
			exactLastSlotRaces: 2,
			scope:
				"Native identity/Org commands, same-operation retry, independent Org/Entity pending caps in commands and SQL, expiry/revocation reclamation and exact last-slot races. Setup commits only to the disposable target; no HTTP, delivery, load or private-contact capacity claim.",
		}),
	);
} finally {
	await pool.end();
	await database.$client.end();
}
