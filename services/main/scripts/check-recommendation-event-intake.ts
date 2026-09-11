import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { initializeObservability } from "@rezics/observability";
import { eq, inArray, sql } from "drizzle-orm";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import {
	users,
	authEntity,
	accountPreference,
	recommendationEvent,
} from "../src/services/database/schema";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { Authorization } from "../src/services/authorization";
import { CatalogIdentityTables } from "../src/services/database/schema/catalog-identity";
import { createCatalogIdentity, recordCatalogChange } from "../src/services/catalog/storage";
import {
	ParticipationDenied,
	runWithParticipationAuthority,
} from "../src/services/participation/policy";
import { createRecommendationTracking } from "../src/services/recommendations/tracking";
import { recordRecommendationEvents } from "../src/services/recommendations/events";
import { UnitNotFound } from "../src/services/units/errors";
import { ValidationError } from "../src/services/api/errors";
const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
);
let checks = 0;
const rollback = new Error("rollback event intake fixture");
async function actor(tx: DatabaseTransaction, name: string) {
	const [account] = await tx
		.insert(users)
		.values({ name, email: `${crypto.randomUUID()}@example.invalid`, emailVerified: true })
		.returning();
	assert.ok(account);
	const self = await ensureSelfEntityInTransaction(tx, account);
	const authority = {
		principal: { kind: "auth" as const, authUserId: account.id },
		actingEntityId: self.id,
		authorizationRevision: self.authorizationRevision,
	};
	return {
		account,
		self,
		authority,
		authorization: new Authorization(self.id, account.id, authority),
	};
}
try {
	await withDatabaseTransactionDeadline(120000, () =>
		database.transaction(async (tx) => {
			const owner = await actor(tx, "Event intake owner"),
				stranger = await actor(tx, "Event intake stranger");
			const publicTarget = await runWithParticipationAuthority(owner.authority, () =>
				createCatalogIdentity(
					tx,
					{ owner: "publishing", shape: "work", status: "published", visibility: "public" },
					owner.account.id,
				),
			);
			const privateTarget = await runWithParticipationAuthority(owner.authority, () =>
				createCatalogIdentity(
					tx,
					{ owner: "publishing", shape: "work", status: "published", visibility: "private" },
					owner.account.id,
				),
			);
			function event(id = publicTarget.id) {
				return {
					id: crypto.randomUUID(),
					targetUnitId: id,
					type: "open" as const,
					occurredAt: new Date(),
					...createRecommendationTracking(id, {
						requestId: crypto.randomUUID(),
						surface: "home_catalog",
						position: 0,
						policyVersion: "native_best_v1",
					}),
				};
			}
			const first = event();
			assert.equal(
				(await recordRecommendationEvents(tx, owner.authorization, [first])).accepted,
				1,
			);
			checks++;
			assert.equal(
				(await recordRecommendationEvents(tx, owner.authorization, [first])).accepted,
				0,
			);
			checks++;
			const [stored] = await tx
				.select()
				.from(recommendationEvent)
				.where(eq(recommendationEvent.id, first.id));
			assert.equal(stored?.authUserId, owner.account.id);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					recordRecommendationEvents(nested, owner.authorization, [
						{ ...event(), signature: "A".repeat(43) },
					]),
				),
				ValidationError,
			);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					recordRecommendationEvents(nested, owner.authorization, [
						{ ...event(), occurredAt: new Date(Date.now() - 86401000) },
					]),
				),
				ValidationError,
			);
			checks++;
			const denied = event(privateTarget.id),
				batchPublic = event();
			await assert.rejects(
				tx.transaction((nested) =>
					recordRecommendationEvents(nested, stranger.authorization, [batchPublic, denied]),
				),
				UnitNotFound,
			);
			checks++;
			assert.equal(
				(
					await tx
						.select()
						.from(recommendationEvent)
						.where(inArray(recommendationEvent.id, [denied.id, batchPublic.id]))
				).length,
				0,
			);
			checks++;
			const anonymous = event();
			assert.equal(
				(await recordRecommendationEvents(tx, new Authorization(undefined), [anonymous])).accepted,
				1,
			);
			checks++;
			assert.equal(
				(
					await tx
						.select()
						.from(recommendationEvent)
						.where(eq(recommendationEvent.id, anonymous.id))
				)[0]?.authUserId,
				null,
			);
			checks++;
			await tx
				.update(accountPreference)
				.set({ personalizedFeed: false })
				.where(eq(accountPreference.authUserId, owner.account.id));
			const optedOut = event();
			await recordRecommendationEvents(tx, owner.authorization, [optedOut]);
			assert.equal(
				(
					await tx.select().from(recommendationEvent).where(eq(recommendationEvent.id, optedOut.id))
				)[0]?.authUserId,
				null,
			);
			checks++;
			const stale = new Authorization(owner.self.id, owner.account.id, {
				...owner.authority,
				authorizationRevision: owner.authority.authorizationRevision + 1,
			});
			await assert.rejects(
				tx.transaction((nested) => recordRecommendationEvents(nested, stale, [event()])),
				ParticipationDenied,
			);
			checks++;
			await tx
				.update(authEntity)
				.set({ state: "suspended", revision: sql`${authEntity.revision}+1` })
				.where(eq(authEntity.authUserId, owner.account.id));
			await assert.rejects(
				tx.transaction((nested) =>
					recordRecommendationEvents(nested, owner.authorization, [event()]),
				),
				ParticipationDenied,
			);
			checks++;
			throw rollback;
		}),
	);
} catch (error) {
	if (error !== rollback) throw error;
}
function eventFor(id: string) {
	return {
		id: crypto.randomUUID(),
		targetUnitId: id,
		type: "open" as const,
		occurredAt: new Date(),
		...createRecommendationTracking(id, {
			requestId: crypto.randomUUID(),
			surface: "home_catalog",
			position: 0,
			policyVersion: "native_best_v1",
		}),
	};
}
async function fixture() {
	return database.transaction(async (tx) => {
		const person = await actor(tx, "Concurrent event intake");
		const target = await runWithParticipationAuthority(person.authority, () =>
			createCatalogIdentity(
				tx,
				{ owner: "publishing", shape: "work", status: "published", visibility: "public" },
				person.account.id,
			),
		);
		return { person, target };
	});
}
async function observe(worker: number, holder: number) {
	let blocked = false;
	for (let attempt = 0; attempt < 200; attempt++) {
		blocked =
			(
				await database.execute<{ blocked: boolean }>(
					sql`select ${holder}=any(pg_blocking_pids(${worker})) as blocked`,
				)
			).rows[0]?.blocked ?? false;
		if (blocked) break;
		await setTimeout(10);
	}
	assert.ok(blocked, "The exact event transaction must meet its holder");
	checks++;
}
for (const change of ["target", "self", "preference"] as const) {
	const { person, target } = await fixture();
	const event = eventFor(target.id),
		ready = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>();
	const changing = database.transaction(async (tx) => {
		if (change === "target")
			await runWithParticipationAuthority(person.authority, async () => {
				await recordCatalogChange(
					tx,
					target,
					person.account.id,
					target.revision,
					"fixture.visibility",
				);
				await tx
					.update(CatalogIdentityTables.publishing)
					.set({ visibility: "private" })
					.where(eq(CatalogIdentityTables.publishing.id, target.id));
			});
		else if (change === "self")
			await tx
				.update(authEntity)
				.set({ revision: sql`${authEntity.revision}+1` })
				.where(eq(authEntity.authUserId, person.account.id));
		else
			await tx
				.update(accountPreference)
				.set({ personalizedFeed: false })
				.where(eq(accountPreference.authUserId, person.account.id));
		ready.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void changing.catch(ready.reject);
	const holder = await ready.promise,
		started = Promise.withResolvers<number>();
	const writing = withDatabaseTransactionDeadline(10000, async () => {
		started.resolve(
			(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return database.transaction((tx) =>
			recordRecommendationEvents(
				tx,
				change === "target" ? new Authorization(undefined) : person.authorization,
				[event],
			),
		);
	});
	void writing.catch(started.reject);
	const outcome =
		change === "preference"
			? writing
			: assert.rejects(writing, change === "target" ? UnitNotFound : ParticipationDenied);
	void outcome.catch(() => {});
	try {
		await observe(await started.promise, holder);
	} finally {
		release.resolve();
		await Promise.all([changing, outcome]);
	}
	const [stored] = await database
		.select()
		.from(recommendationEvent)
		.where(eq(recommendationEvent.id, event.id));
	if (change === "preference") {
		assert.ok(stored);
		assert.equal(stored.authUserId, null);
		checks++;
	} else {
		assert.equal(stored, undefined);
		checks++;
	}
}
const { person, target: orderedTarget } = await fixture();
const orderedEvent = eventFor(orderedTarget.id),
	admitted = Promise.withResolvers<number>(),
	commit = Promise.withResolvers<void>();
const admittedWrite = withDatabaseTransactionDeadline(10000, async () => {
	const pid = (await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`))
		.rows[0]!.pid;
	const result = await database.transaction((tx) =>
		recordRecommendationEvents(tx, new Authorization(undefined), [orderedEvent]),
	);
	assert.equal(result.accepted, 1);
	checks++;
	admitted.resolve(pid);
	await commit.promise;
});
void admittedWrite.catch(admitted.reject);
const writerPid = await admitted.promise,
	changeStarted = Promise.withResolvers<number>();
const laterChange = database.transaction((tx) =>
	runWithParticipationAuthority(person.authority, async () => {
		changeStarted.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await recordCatalogChange(
			tx,
			orderedTarget,
			person.account.id,
			orderedTarget.revision,
			"fixture.visibility",
		);
		await tx
			.update(CatalogIdentityTables.publishing)
			.set({ visibility: "private" })
			.where(eq(CatalogIdentityTables.publishing.id, orderedTarget.id));
	}),
);
void laterChange.catch(changeStarted.reject);
try {
	await observe(await changeStarted.promise, writerPid);
} finally {
	commit.resolve();
	await Promise.all([admittedWrite, laterChange]);
}
assert.equal(
	(
		await database
			.select()
			.from(recommendationEvent)
			.where(eq(recommendationEvent.id, orderedEvent.id))
	).length,
	1,
);
checks++;
// Event freshness is evaluated after resource waits, not when the request first arrives.
const timed = await fixture(),
	timeReady = Promise.withResolvers<number>(),
	timeRelease = Promise.withResolvers<void>();
const timeHolder = database.transaction(async (tx) => {
	await tx
		.select()
		.from(CatalogIdentityTables.publishing)
		.where(eq(CatalogIdentityTables.publishing.id, timed.target.id))
		.for("update");
	timeReady.resolve(
		(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
	);
	await timeRelease.promise;
});
void timeHolder.catch(timeReady.reject);
const timeBlocker = await timeReady.promise;
const {
	rows: [time],
} = await database.execute<{ occurred: Date }>(
	sql`select clock_timestamp()-interval '24 hours'+interval '1800 milliseconds' as occurred`,
);
assert.ok(time);
const timedEvent = { ...eventFor(timed.target.id), occurredAt: new Date(time.occurred) },
	timedStarted = Promise.withResolvers<number>();
const timedWrite = withDatabaseTransactionDeadline(10000, async () => {
	timedStarted.resolve(
		(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
	);
	return database.transaction((tx) =>
		recordRecommendationEvents(tx, new Authorization(undefined), [timedEvent]),
	);
});
void timedWrite.catch(timedStarted.reject);
const timedDenial = assert.rejects(timedWrite, ValidationError);
void timedDenial.catch(() => {});
try {
	await observe(await timedStarted.promise, timeBlocker);
	await database.execute(
		sql`select pg_sleep(greatest(0,extract(epoch from (${timedEvent.occurredAt.toISOString()}::timestamptz+interval '24 hours'-clock_timestamp())))+0.025)`,
	);
} finally {
	timeRelease.resolve();
	await Promise.all([timeHolder, timedDenial]);
}
assert.equal(
	(
		await database
			.select()
			.from(recommendationEvent)
			.where(eq(recommendationEvent.id, timedEvent.id))
	).length,
	0,
);
checks++;

const observability = initializeObservability({
	service: { name: "recommendation-event-api-fixture", version: "1", environment: "tooling" },
});
const { default: api } = await import("../src/services/api");
api.compile();
const { auth } = await import("../src/services/auth");
const { serializeSignedCookie } = await import("better-call");
const apiFixture = await fixture(),
	ctx = await auth.$context;
const session = await ctx.internalAdapter.createSession(apiFixture.person.account.id);
const [cookie] = (
	await serializeSignedCookie(ctx.authCookies.sessionToken.name, session.token, ctx.secret, {
		path: "/",
	})
).split(";");
assert.ok(cookie);
let httpChecks = 0;
async function send(
	events: ReturnType<typeof eventFor>[],
	expectedStatus: number,
	authenticated = true,
) {
	const response = await api.fetch(
		new Request("http://localhost:3001/api/v1/recommendations/events", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(authenticated ? { Cookie: cookie! } : {}),
			},
			body: JSON.stringify({ events }),
		}),
	);
	const body = await response.json();
	assert.equal(response.status, expectedStatus, JSON.stringify(body));
	httpChecks++;
	return body as { accepted?: number };
}
const posted = eventFor(apiFixture.target.id);
assert.equal((await send([posted], 200)).accepted, 1);
checks++;
assert.equal((await send([posted], 200)).accepted, 0);
checks++;
await send([{ ...eventFor(apiFixture.target.id), signature: "A".repeat(43) }], 422);
await send(
	[{ ...eventFor(apiFixture.target.id), occurredAt: new Date(Date.now() - 86401000) }],
	422,
);
await send(
	Array.from({ length: 101 }, () => eventFor(apiFixture.target.id)),
	422,
);
const batchTargets = await database.transaction((tx) =>
	runWithParticipationAuthority(apiFixture.person.authority, async () => {
		const ids: string[] = [];
		for (let index = 0; index < 100; index++)
			ids.push(
				(
					await createCatalogIdentity(
						tx,
						{ owner: "publishing", shape: "work", status: "published", visibility: "public" },
						apiFixture.person.account.id,
					)
				).id,
			);
		return ids;
	}),
);
const startedBatch = performance.now();
assert.equal((await send(batchTargets.map(eventFor), 200)).accepted, 100);
checks++;
const fullBatchMilliseconds = performance.now() - startedBatch;
const anon = eventFor(apiFixture.target.id);
assert.equal((await send([anon], 200, false)).accepted, 1);
checks++;
assert.equal(
	(await database.select().from(recommendationEvent).where(eq(recommendationEvent.id, anon.id)))[0]
		?.authUserId,
	null,
);
checks++;
await database
	.update(accountPreference)
	.set({ personalizedFeed: false })
	.where(eq(accountPreference.authUserId, apiFixture.person.account.id));
const preferenceEvent = eventFor(apiFixture.target.id);
assert.equal((await send([preferenceEvent], 200)).accepted, 1);
checks++;
assert.equal(
	(
		await database
			.select()
			.from(recommendationEvent)
			.where(eq(recommendationEvent.id, preferenceEvent.id))
	)[0]?.authUserId,
	null,
);
checks++;
await send([eventFor(orderedTarget.id)], 404, false);

const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-recommendation-event-intake.ts",
	"services/main/src/services/recommendations/events.ts",
	"services/main/src/services/api/recommendations/index.ts",
	"services/main/src/services/recommendations/policy.ts",
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
				sql`select version() as postgres,current_setting('default_transaction_isolation') as default_isolation`,
			)
		).rows[0],
		checks,
		httpChecks,
		fullBatchMilliseconds,
		maxDistinctTargets: 100,
		currentEventIntakeQualified: true,
		rollbackScenarios: true,
		orderedRaces: 5,
		eventTimeRecheckedAfterWait: true,
		fixtureHistoryRetained: true,
	}),
);
await database.$client.end();
await observability.shutdown();
