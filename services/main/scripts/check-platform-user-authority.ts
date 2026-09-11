import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { OfficialRealmUnitIds } from "@rezics/slug";
import { and, desc, eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import { database, withDatabaseTransactionDeadline } from "../src/services/database";
import {
	users,
	sessions,
	realm,
	realmRuleRevision,
	realmRule,
	platformCapabilityGrant,
	userAccountState,
	governanceDecision,
} from "../src/services/database/schema";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { Authorization } from "../src/services/authorization";
import { PlatformCapabilityRequired } from "../src/services/authorization/errors";
import { AccountClosed, AccountSuspended } from "../src/services/auth/errors";
import {
	UserAccountStateRevisionConflict,
	UserSelfStatusChangeForbidden,
} from "../src/services/api/users/errors";
import {
	replacePlatformUserAccountState,
	revokePlatformUserSession,
	revokeAllPlatformUserSessions,
} from "../src/services/platform-users/service";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Platform user qualification requires a disposable loopback target",
);
let checks = 0;
function check(actual: unknown, expected: unknown, message: string) {
	assert.deepEqual(actual, expected, message);
	checks++;
}
async function rejected(work: Promise<unknown>, error: new (...args: never[]) => Error) {
	await assert.rejects(work, error);
	checks++;
}
async function actor(name: string) {
	return database.transaction(async (tx) => {
		const [account] = await tx
			.insert(users)
			.values({ name, email: `${crypto.randomUUID()}@example.invalid`, emailVerified: true })
			.returning();
		assert.ok(account);
		const self = await ensureSelfEntityInTransaction(tx, account);
		return { account, self, authorization: new Authorization(self.id, account.id) };
	});
}
type Actor = Awaited<ReturnType<typeof actor>>;
async function grant(
	person: Actor,
	capability: "platform.user.status.update" | "platform.session.revoke",
	expiresAt?: Date,
) {
	const [row] = await database
		.insert(platformCapabilityGrant)
		.values({
			authUserId: person.account.id,
			grantedByAuthUserId: person.account.id,
			capability,
			expiresAt,
		})
		.returning();
	assert.ok(row);
	return row;
}
async function session(person: Actor) {
	const [row] = await database
		.insert(sessions)
		.values({
			userId: person.account.id,
			token: crypto.randomUUID(),
			expiresAt: new Date(Date.now() + 86400000),
		})
		.returning();
	assert.ok(row);
	return row;
}
const operator = await actor("Platform fixture operator"),
	subject = await actor("Platform fixture subject"),
	backup = await actor("Platform fixture backup");
const rules = await database.transaction(async (tx) => {
	await tx.insert(realm).values({ id: OfficialRealmUnitIds.rule }).onConflictDoNothing();
	let [revision] = await tx
		.select()
		.from(realmRuleRevision)
		.where(eq(realmRuleRevision.realmId, OfficialRealmUnitIds.rule))
		.orderBy(desc(realmRuleRevision.version))
		.limit(1);
	if (!revision)
		[revision] = await tx
			.insert(realmRuleRevision)
			.values({
				realmId: OfficialRealmUnitIds.rule,
				version: 1,
				createdByProfileId: operator.self.id,
				publishedAt: new Date(),
			})
			.returning();
	assert.ok(revision);
	let [rule] = await tx
		.select()
		.from(realmRule)
		.where(eq(realmRule.revisionId, revision.id))
		.limit(1);
	if (!rule)
		[rule] = await tx
			.insert(realmRule)
			.values({ revisionId: revision.id, position: 0 })
			.returning();
	assert.ok(rule);
	return [{ sourceRealmId: OfficialRealmUnitIds.rule, revisionId: revision.id, ruleId: rule.id }];
});
const input = (person: Actor, recipient = subject) => ({
	authorization: person.authorization,
	targetUserId: recipient.account.id,
});
const replace = (
	person: Actor,
	recipient: Actor,
	state: "active" | "suspended" | "closed",
	expectedRevision: number,
) =>
	replacePlatformUserAccountState({
		...input(person, recipient),
		command: { state, expectedRevision, rules },
	});
const saved = await session(subject);
await rejected(replace(operator, subject, "active", 0), PlatformCapabilityRequired);
await rejected(
	revokePlatformUserSession({ ...input(operator), sessionId: saved.id }),
	PlatformCapabilityRequired,
);
await rejected(revokeAllPlatformUserSessions(input(operator)), PlatformCapabilityRequired);
check(
	(await database.select().from(sessions).where(eq(sessions.id, saved.id))).length,
	1,
	"denied session commands retain the session",
);
const statusGrant = await grant(operator, "platform.user.status.update");
const sessionGrant = await grant(operator, "platform.session.revoke");
await grant(backup, "platform.user.status.update");
await grant(backup, "platform.session.revoke");
await operator.authorization.platform.decideCapability("platform.user.status.update");
await operator.authorization.platform.decideCapability("platform.session.revoke");
await database
	.update(platformCapabilityGrant)
	.set({ revokedAt: new Date(), revokedByAuthUserId: backup.account.id })
	.where(eq(platformCapabilityGrant.id, statusGrant.id));
await rejected(replace(operator, subject, "suspended", 0), PlatformCapabilityRequired);
await database
	.update(platformCapabilityGrant)
	.set({ revokedAt: new Date(), revokedByAuthUserId: backup.account.id })
	.where(eq(platformCapabilityGrant.id, sessionGrant.id));
await rejected(
	revokePlatformUserSession({ ...input(operator), sessionId: saved.id }),
	PlatformCapabilityRequired,
);
await rejected(revokeAllPlatformUserSessions(input(operator)), PlatformCapabilityRequired);
await grant(operator, "platform.user.status.update");
await grant(operator, "platform.session.revoke");
check(
	(await replace(operator, subject, "suspended", 0)).revision,
	1,
	"suspension advances account revision",
);
check(
	(await database.select().from(sessions).where(eq(sessions.userId, subject.account.id))).length,
	0,
	"suspension removes existing sessions atomically",
);
const [state] = await database
	.select()
	.from(userAccountState)
	.where(eq(userAccountState.userId, subject.account.id));
assert.ok(state?.decisionId);
check(
	(
		await database
			.select()
			.from(governanceDecision)
			.where(
				and(
					eq(governanceDecision.id, state.decisionId),
					eq(governanceDecision.targetUserId, subject.account.id),
				),
			)
	).length,
	1,
	"suspension has a real target-bound governance decision",
);
await rejected(replace(operator, subject, "active", 0), UserAccountStateRevisionConflict);
check(
	(await replace(operator, subject, "active", 1)).revision,
	2,
	"restoration preserves revision history",
);
await rejected(replace(operator, operator, "closed", 0), UserSelfStatusChangeForbidden);
const one = await session(subject),
	two = await session(subject);
check(
	(await revokePlatformUserSession({ ...input(operator), sessionId: one.id })).revokedCount,
	1,
	"authorized single-session revocation",
);
check(
	(await database.select().from(sessions).where(eq(sessions.id, two.id))).length,
	1,
	"single revocation retains other sessions",
);
check(
	(await revokeAllPlatformUserSessions(input(operator))).revokedCount,
	1,
	"authorized all-session revocation",
);
await replace(backup, operator, "suspended", 0);
await rejected(replace(operator, subject, "closed", 2), AccountSuspended);
await rejected(revokeAllPlatformUserSessions(input(operator)), AccountSuspended);
await replace(backup, operator, "active", 1);
await replace(backup, operator, "closed", 2);
await rejected(replace(operator, subject, "closed", 2), AccountClosed);
await rejected(revokeAllPlatformUserSessions(input(operator)), AccountClosed);

const pool = new Pool({ connectionString: target.toString(), max: 3, statement_timeout: 15000 });
async function observeBlock(waiter: number, blocker: number, deadline?: Date) {
	let blocked = false;
	for (let attempt = 0; attempt < 600; attempt++) {
		const result = await pool.query<{ blocked: boolean; expired: boolean }>(
			"select $2::integer = any(pg_blocking_pids($1)) as blocked, ($3::timestamptz is null or clock_timestamp() > $3::timestamptz + interval '25 milliseconds') as expired",
			[waiter, blocker, deadline ?? null],
		);
		blocked ||= result.rows[0]?.blocked ?? false;
		if (blocked && result.rows[0]?.expired) return;
		await setTimeout(10);
	}
	throw new Error("Expected exact lock blocker/deadline was not observed");
}
try {
	// Revocation commits before the command's grant checkpoint. A prior allowed
	// presentation result cannot authorize a later mutation.
	for (const command of ["state", "one-session", "all-sessions"] as const) {
		const manager = await actor(`Race ${command}`),
			recipient = await actor(`Race target ${command}`);
		const capability =
			command === "state" ? "platform.user.status.update" : "platform.session.revoke";
		const authority = await grant(manager, capability),
			token = await session(recipient);
		await manager.authorization.platform.ensureCapability(capability);
		const client = await pool.connect();
		await client.query("begin");
		const blocker = (await client.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]!
			.pid;
		await client.query(
			"update platform_capability_grant set revoked_at = clock_timestamp(), revoked_by_auth_user_id = $2 where id = $1",
			[authority.id, backup.account.id],
		);
		const started = Promise.withResolvers<number>();
		const work = withDatabaseTransactionDeadline(14000, async () => {
			started.resolve(
				(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
			);
			if (command === "state") return replace(manager, recipient, "suspended", 0);
			if (command === "one-session")
				return revokePlatformUserSession({ ...input(manager, recipient), sessionId: token.id });
			return revokeAllPlatformUserSessions(input(manager, recipient));
		});
		void work.catch(started.reject);
		const denied = rejected(work, PlatformCapabilityRequired);
		void denied.catch(() => {});
		try {
			await observeBlock(await started.promise, blocker);
			checks++;
		} finally {
			await client.query("commit");
			client.release();
			await denied;
		}
		check(
			(await database.select().from(sessions).where(eq(sessions.id, token.id))).length,
			1,
			`${command} loses to revocation without deleting sessions`,
		);
		check(
			(
				await database
					.select()
					.from(userAccountState)
					.where(eq(userAccountState.userId, recipient.account.id))
			).length,
			0,
			`${command} loses to revocation without writing state`,
		);
	}
	// Expiry while waiting on the target account is evaluated after the wait.
	const manager = await actor("Expiring state operator"),
		recipient = await actor("Expiry target");
	const expiry = new Date(Date.now() + 1800);
	await grant(manager, "platform.user.status.update", expiry);
	const client = await pool.connect();
	await client.query("begin");
	const blocker = (await client.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]!
		.pid;
	await client.query("select id from users where id=$1 for update", [recipient.account.id]);
	const started = Promise.withResolvers<number>();
	const work = withDatabaseTransactionDeadline(14000, async () => {
		started.resolve(
			(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return replace(manager, recipient, "suspended", 0);
	});
	void work.catch(started.reject);
	const denied = rejected(work, PlatformCapabilityRequired);
	void denied.catch(() => {});
	try {
		await observeBlock(await started.promise, blocker, expiry);
		checks++;
	} finally {
		await client.query("commit");
		client.release();
		await denied;
	}
	check(
		(
			await database
				.select()
				.from(userAccountState)
				.where(eq(userAccountState.userId, recipient.account.id))
		).length,
		0,
		"expired operator writes no state after a target-row wait",
	);

	// The first state change retains admission locks through commit; the waiting
	// operator must observe its own suspension before making a reciprocal change.
	const first = await actor("Reciprocal first"),
		second = await actor("Reciprocal second");
	await grant(first, "platform.user.status.update");
	await grant(second, "platform.user.status.update");
	const held = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>();
	const winner = withDatabaseTransactionDeadline(14000, async () => {
		const result = await replace(first, second, "suspended", 0);
		check(result.revision, 1, "first reciprocal command writes its state");
		held.resolve(
			(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void winner.catch(held.reject);
	const winnerPid = await held.promise;
	const waiting = Promise.withResolvers<number>();
	const loser = withDatabaseTransactionDeadline(14000, async () => {
		waiting.resolve(
			(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return replace(second, first, "suspended", 0);
	});
	void loser.catch(waiting.reject);
	const loses = rejected(loser, AccountSuspended);
	void loses.catch(() => {});
	try {
		await observeBlock(await waiting.promise, winnerPid);
		checks++;
	} finally {
		release.resolve();
		await winner;
		await loses;
	}
	check(
		(
			await database
				.select()
				.from(userAccountState)
				.where(eq(userAccountState.userId, first.account.id))
		).length,
		0,
		"suspended reciprocal operator changes no account",
	);
} finally {
	await pool.end();
}
// Exercise real route adapters with fresh signed sessions and produced IDs.
const { initializeObservability } = await import("@rezics/observability");
const observability = initializeObservability({
	service: { name: "rezics-platform-user-qualification", version: "1.0.0", environment: "tooling" },
});
const { serializeSignedCookie } = await import("better-call");
const { auth } = await import("../src/services/auth");
const { default: api } = await import("../src/services/api");
api.compile();
const context = await auth.$context;
async function cookie(person: Actor) {
	const record = await context.internalAdapter.createSession(person.account.id);
	const [value] = (
		await serializeSignedCookie(
			context.authCookies.sessionToken.name,
			record.token,
			context.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(value);
	return value;
}
const httpOperator = await actor("HTTP state operator"),
	httpSubject = await actor("HTTP state subject"),
	outsider = await actor("HTTP outsider");
await grant(httpOperator, "platform.user.status.update");
await grant(httpOperator, "platform.session.revoke");
const operatorCookie = await cookie(httpOperator),
	outsiderCookie = await cookie(outsider);
let httpChecks = 0;
async function request(
	method: string,
	path: string,
	body: unknown,
	expectedStatus: number,
	token = operatorCookie,
) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1/platform-users/${path}`, {
			method,
			headers: {
				Cookie: token,
				...(body === undefined ? {} : { "Content-Type": "application/json" }),
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
	);
	const text = await response.text();
	check(response.status, expectedStatus, `${method} ${path}: ${text.slice(0, 1000)}`);
	httpChecks++;
	return text ? JSON.parse(text) : null;
}
try {
	const path = `${httpSubject.account.id}/account-state`;
	await request(
		"PUT",
		path,
		{ state: "suspended", expectedRevision: 0, rules },
		403,
		outsiderCookie,
	);
	const initial = await session(httpSubject);
	const result = await request(
		"PUT",
		path,
		{ state: "suspended", expectedRevision: 0, rules },
		200,
	);
	check(result.revision, 1, "HTTP suspension returns the committed revision");
	check(
		(await database.select().from(sessions).where(eq(sessions.id, initial.id))).length,
		0,
		"HTTP suspension removes target sessions",
	);
	await request("PUT", path, { state: "active", expectedRevision: 0, rules }, 409);
	await request("PUT", path, { state: "active", expectedRevision: result.revision, rules }, 200);
	const token = await session(httpSubject);
	await request(
		"DELETE",
		`${httpSubject.account.id}/sessions/${token.id}`,
		undefined,
		403,
		outsiderCookie,
	);
	await request("DELETE", `${httpSubject.account.id}/sessions/${token.id}`, undefined, 200);
	await request("DELETE", `${httpSubject.account.id}/sessions/${token.id}`, undefined, 404);
	await session(httpSubject);
	await session(httpSubject);
	await request("DELETE", `${httpSubject.account.id}/sessions`, undefined, 200);
	await request(
		"PUT",
		`${httpOperator.account.id}/account-state`,
		{ state: "closed", expectedRevision: 0, rules },
		409,
	);
	await request("PUT", path, { state: "closed", expectedRevision: 2, rules }, 200);
} finally {
	await observability.shutdown();
}
const repository = new URL("../../../", import.meta.url);
const sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-platform-user-authority.ts",
	"services/main/src/services/platform-users/service.ts",
	"services/main/src/services/api/platform-users/index.ts",
	"services/main/src/services/platform-access/service.ts",
	"services/main/src/services/authorization/platform/authorization.ts",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(path, repository)))
		.digest("hex");
console.info(
	JSON.stringify({
		baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: fileURLToPath(repository),
			encoding: "utf8",
		}).trim(),
		sourceDigests,
		node: process.version,
		platform: `${process.platform}/${process.arch}`,
		runtime: (
			await database.execute(
				sql`select version() as postgres, current_setting('default_transaction_isolation') as default_isolation`,
			)
		).rows[0],
		checks,
		httpChecks,
		revokedOperatorQualified: true,
		accountStateQualified: true,
		targetWaitExpiryQualified: true,
	}),
);
console.info(
	`Verified ${checks} platform user authority and account-state assertions; generated actors remain only in the disposable target.`,
);
process.exit(0);
