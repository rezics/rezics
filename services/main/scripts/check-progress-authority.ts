import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import { initializeObservability } from "@rezics/observability";
import { database } from "../src/services/database";
import { users, authEntity, unitProgress } from "../src/services/database/schema";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { createCatalogIdentity } from "../src/services/catalog/storage";
import { runWithParticipationAuthority } from "../src/services/participation/policy";
const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
);
const observability = initializeObservability({
	service: { name: "progress-authority-fixture", version: "1", environment: "tooling" },
});
const { default: api } = await import("../src/services/api");
api.compile();
const { auth } = await import("../src/services/auth");
const { serializeSignedCookie } = await import("better-call");
const fixture = await database.transaction(async (tx) => {
	const [account] = await tx
		.insert(users)
		.values({
			name: "Progress authority owner",
			email: `${crypto.randomUUID()}@example.invalid`,
			emailVerified: true,
		})
		.returning();
	assert.ok(account);
	const self = await ensureSelfEntityInTransaction(tx, account);
	const authority = {
		principal: { kind: "auth" as const, authUserId: account.id },
		actingEntityId: self.id,
		authorizationRevision: self.authorizationRevision,
	};
	const resource = await runWithParticipationAuthority(authority, () =>
		createCatalogIdentity(
			tx,
			{ owner: "publishing", shape: "work", visibility: "public", status: "published" },
			account.id,
		),
	);
	return { account, self, resource };
});
const context = await auth.$context;
const session = await context.internalAdapter.createSession(fixture.account.id);
const [cookie] = (
	await serializeSignedCookie(
		context.authCookies.sessionToken.name,
		session.token,
		context.secret,
		{ path: "/" },
	)
).split(";");
assert.ok(cookie);
const ready = Promise.withResolvers<number>(),
	release = Promise.withResolvers<void>();
const holding = database.transaction(async (tx) => {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`unit-progress:${fixture.account.id}:${fixture.resource.id}`}::text,0))`,
	);
	ready.resolve(
		(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
	);
	await release.promise;
});
void holding.catch(ready.reject);
const holder = await ready.promise;
const request = api.fetch(
	new Request(`http://localhost:3001/api/v1/progress/${fixture.resource.id}`, {
		method: "PUT",
		headers: { Cookie: cookie, "Content-Type": "application/json" },
		body: JSON.stringify({ status: "active", progress: 0.3 }),
	}),
);
void Promise.resolve(request).catch(() => {});
let workerPid: number | undefined;
let changing: Promise<void> | undefined;
let checks = 0,
	httpChecks = 1;
async function observe(worker: number, holder: number) {
	for (let attempt = 0; attempt < 300; attempt++) {
		if (
			(
				await database.execute<{ blocked: boolean }>(
					sql`select ${holder}=any(pg_blocking_pids(${worker})) as blocked`,
				)
			).rows[0]?.blocked
		) {
			checks++;
			return;
		}
		await setTimeout(10);
	}
	throw new Error("The exact Progress authority blocker was not observed");
}
try {
	for (let attempt = 0; attempt < 500; attempt++) {
		const rows = (
			await database.execute<{ pid: number }>(
				sql`select pid from pg_stat_activity where ${holder}=any(pg_blocking_pids(pid)) and wait_event='advisory'`,
			)
		).rows;
		if (rows.length === 1) {
			workerPid = rows[0]!.pid;
			break;
		}
		await setTimeout(10);
	}
	assert.ok(workerPid, "Progress request must reach its exact journal lock");
	checks++;
	const changeReady = Promise.withResolvers<number>();
	changing = database.transaction(async (tx) => {
		changeReady.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await tx
			.update(authEntity)
			.set({ revision: sql`${authEntity.revision}+1` })
			.where(eq(authEntity.authUserId, fixture.account.id));
	});
	void changing.catch(changeReady.reject);
	await observe(await changeReady.promise, workerPid);
} finally {
	release.resolve();
	await holding;
	await changing;
}
const response = await request;
const body = await response.text();
assert.equal(response.status, 200, body);
checks++;
assert.equal(
	(
		await database
			.select()
			.from(unitProgress)
			.where(eq(unitProgress.authUserId, fixture.account.id))
	).length,
	1,
);
checks++;
async function call(
	method: string,
	path: string,
	status: number,
	body?: unknown,
	signed = true,
	invalidSelection = false,
) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1/progress/${fixture.resource.id}${path}`, {
			method,
			headers: {
				...(signed ? { Cookie: cookie! } : {}),
				...(body ? { "Content-Type": "application/json" } : {}),
				...(invalidSelection
					? {
							"X-Rezics-Participation": JSON.stringify({
								actingEntityId: fixture.self.id,
								grant: { id: crypto.randomUUID(), revision: 1 },
							}),
						}
					: {}),
			},
			...(body ? { body: JSON.stringify(body) } : {}),
		}),
	);
	const text = await response.text();
	assert.equal(response.status, status, text);
	httpChecks++;
	return text ? JSON.parse(text) : undefined;
}
await call("GET", "", 401, undefined, false);
assert.equal((await call("GET", "", 200)).record.status, "active");
checks++;
const entry = await call("POST", "/entries", 200, {
	entryKind: "update",
	status: "paused",
	progress: 0.4,
	occurredAt: null,
	datePrecision: "unknown",
});
assert.equal(typeof entry.id, "string");
checks++;
const completed = await call("PUT", `/entries/${entry.id}`, 200, {
	entryKind: "completion",
	status: "completed",
	progress: 1,
	occurredAt: null,
	datePrecision: "unknown",
});
assert.equal(completed.id, entry.id);
checks++;
await call("PUT", `/entries/${entry.id}/current`, 204);
assert.equal((await call("GET", "", 200)).record.status, "completed");
checks++;
await call("DELETE", `/entries/${entry.id}`, 204);
assert.equal((await call("GET", "", 200)).record.status, "active");
checks++;
await call("POST", "/complete", 200, {});
assert.equal((await call("GET", "", 200)).record.status, "completed");
checks++;
await call("PUT", "", 200, { status: "paused", progress: 0.5, visibility: "private" });
assert.equal((await call("GET", "", 200)).record.visibility, "private");
checks++;
await call("DELETE", "", 204);
assert.equal((await call("GET", "", 200)).state, "untracked");
checks++;
await call("PUT", "", 200, { status: "active", progress: 0.1 });
assert.equal((await call("GET", "", 200)).record.progress, 0.1);
checks++;
assert.equal(
	(await call("PUT", "", 403, { status: "paused" }, true, true)).error.code,
	"ParticipationDenied",
);
checks++;
const sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-progress-authority.ts",
	"services/main/src/services/api/progress/authority.ts",
	"services/main/src/services/api/progress/index.ts",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(`../../../${path}`, import.meta.url)))
		.digest("hex");
console.info(
	JSON.stringify({
		checks,
		httpChecks,
		orderedAuthorityWaits: 2,
		sourceDigests,
		committedFixtures: true,
	}),
);
await database.$client.end();
await observability.shutdown();
