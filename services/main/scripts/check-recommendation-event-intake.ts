import { createFixtureSessionContext } from "./native-enrollment-fixture";
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
	accountErasure,
} from "../src/services/database/schema";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { Authorization } from "../src/services/authorization";
import { CatalogIdentityTables } from "@rezics/schema/postgres/catalog/identity";
import { createCatalogIdentity, recordCatalogChange } from "../src/services/catalog/storage";
import {
	ParticipationDenied,
	runWithParticipationAuthority,
} from "../src/services/participation/policy";
import { createRecommendationTracking } from "../src/services/recommendations/tracking";
import { recordRecommendationEvents } from "../src/services/recommendations/events";
import {
	eraseOwnAccount,
	dispatchAccountErasureBatch,
} from "../src/services/participation/erasure";
import { saveRecommendationExclusion } from "../src/services/recommendations/exclusions";
import { findReferenceValueByNativeId } from "../src/services/units/reference-value";
import { createMergedFixtureReference } from "./reference-merge-fixture";
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
			const eventPolicy = `event-fixture:${crypto.randomUUID()}`;
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
						policyVersion: eventPolicy,
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
			assert.ok(stored);
			const referenceReceipt = await tx.execute<{ target: string }>(sql`
				select value.target_publishing_id as target from recommendation_event event
				join reference_value value on value.id=event.target_reference_id where event.id=${first.id}::uuid`);
			assert.equal(referenceReceipt.rows[0]?.target, publicTarget.id);
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
			const signals = async (id = publicTarget.id) =>
				(
					await tx.execute(sql`
				select kind, signal_count::integer as count, weight from recommendation_unit_signal_hourly
				where unit_id=${id}::uuid order by kind::text,bucket_start`)
				).rows;
			const metrics = async () =>
				(
					await tx.execute(sql`
				select coalesce(sum(opens),0)::integer as opens,
				coalesce(sum(not_interested),0)::integer as exclusions from recommendation_metric_daily
				where policy_version=${eventPolicy}`)
				).rows;
			assert.deepEqual(await signals(), [{ kind: "open", count: 1, weight: 1 }]);
			checks++;
			assert.deepEqual(await metrics(), [{ opens: 3, exclusions: 0 }]);
			checks++;
			// Transport replay also deduplicates a new event UUID with the same observation key.
			assert.equal(
				(
					await recordRecommendationEvents(tx, owner.authorization, [
						{ ...first, id: crypto.randomUUID() },
					])
				).accepted,
				0,
			);
			checks++;
			assert.deepEqual(await metrics(), [{ opens: 3, exclusions: 0 }]);
			checks++;
			const shared = event();
			await recordRecommendationEvents(tx, stranger.authorization, [shared]);
			assert.equal(
				(
					await tx.select().from(recommendationEvent).where(eq(recommendationEvent.id, shared.id))
				)[0]?.targetReferenceId,
				stored.targetReferenceId,
			);
			checks++;
			const exclusion = event();
			await saveRecommendationExclusion(tx, stranger.authorization, publicTarget.id, {
				eventId: exclusion.id,
				requestId: exclusion.requestId,
				surface: exclusion.surface,
				position: 0,
				policyVersion: eventPolicy,
				occurredAt: exclusion.occurredAt,
			});
			const choice =
				await tx.execute(sql`select target_reference_id as reference from recommendation_exclusion
				where auth_user_id=${stranger.account.id}::uuid`);
			assert.deepEqual(choice.rows, [{ reference: stored.targetReferenceId }]);
			checks++;
			assert.equal(
				(
					await tx
						.select()
						.from(recommendationEvent)
						.where(eq(recommendationEvent.id, exclusion.id))
				)[0]?.targetReferenceId,
				stored.targetReferenceId,
			);
			checks++;
			assert.deepEqual(
				await signals(),
				[
					{ kind: "open", count: 2, weight: 2 },
					{ kind: "not_interested", count: 1, weight: 0 },
				].sort((a, b) => a.kind.localeCompare(b.kind)),
			);
			checks++;
			assert.deepEqual(await metrics(), [{ opens: 4, exclusions: 1 }]);
			checks++;
			function sqlState(error: unknown): string | undefined {
				if (!error || typeof error !== "object") return;
				if ("code" in error && typeof error.code === "string") return error.code;
				return "cause" in error ? sqlState(error.cause) : undefined;
			}
			await assert.rejects(
				tx.transaction((nested) =>
					nested.insert(recommendationEvent).values({
						...stored,
						id: crypto.randomUUID(),
						requestId: crypto.randomUUID(),
						targetReferenceId: crypto.randomUUID(),
					}),
				),
				(error) => sqlState(error) === "23503",
			);
			checks++;
			// A newly allocated CTE reference must be visible to the AFTER INSERT signal trigger.
			const cteTarget = await runWithParticipationAuthority(owner.authority, () =>
				createCatalogIdentity(
					tx,
					{ owner: "publishing", shape: "work", status: "published", visibility: "public" },
					owner.account.id,
				),
			);
			assert.equal(await findReferenceValueByNativeId(tx, cteTarget.id), undefined);
			checks++;
			await tx.execute(sql`with allocated as (
				insert into reference_value(target_publishing_id) values(${cteTarget.id}::uuid) returning id
			) insert into recommendation_event(auth_user_id,request_id,surface,type,target_reference_id,position,policy_version,occurred_at)
			select ${stranger.account.id}::uuid,gen_random_uuid(),'home_catalog','dwell_30s',id,0,${eventPolicy},statement_timestamp() from allocated`);
			assert.deepEqual(await signals(cteTarget.id), [{ kind: "dwell_30s", count: 1, weight: 2 }]);
			checks++;
			// Failed time validation rolls back an allocation made after successful target authorization.
			const invalidTarget = await runWithParticipationAuthority(owner.authority, () =>
				createCatalogIdentity(
					tx,
					{ owner: "publishing", shape: "work", status: "published", visibility: "public" },
					owner.account.id,
				),
			);
			await assert.rejects(
				tx.transaction((nested) =>
					recordRecommendationEvents(nested, owner.authorization, [
						{ ...event(invalidTarget.id), occurredAt: new Date(Date.now() - 86401000) },
					]),
				),
				ValidationError,
			);
			checks++;
			assert.equal(await findReferenceValueByNativeId(tx, invalidTarget.id), undefined);
			checks++;
			const beforeErasure = {
				signals: await signals(),
				cte: await signals(cteTarget.id),
				metrics: await metrics(),
			};
			await runWithParticipationAuthority(stranger.authority, async () =>
				eraseOwnAccount(tx, await createFixtureSessionContext(tx, stranger.authority.principal.authUserId)),
			);
			let complete = false;
			for (let page = 0; page < 100; page++) {
				await tx
					.update(accountErasure)
					.set({ availableAt: new Date(0) })
					.where(eq(accountErasure.authUserId, stranger.account.id));
				await dispatchAccountErasureBatch({ authUserId: stranger.account.id });
				if (
					(
						await tx
							.select()
							.from(accountErasure)
							.where(eq(accountErasure.authUserId, stranger.account.id))
					)[0]?.stage === "complete"
				) {
					complete = true;
					break;
				}
			}
			assert.ok(complete, "Account erasure must complete through its actual worker");
			checks++;
			assert.equal(
				(
					await tx
						.select()
						.from(recommendationEvent)
						.where(eq(recommendationEvent.authUserId, stranger.account.id))
				).length,
				0,
			);
			checks++;
			assert.equal(
				(await findReferenceValueByNativeId(tx, publicTarget.id))?.valueId,
				stored.targetReferenceId,
			);
			checks++;
			assert.equal(
				(await tx.select().from(recommendationEvent).where(eq(recommendationEvent.id, first.id)))
					.length,
				1,
			);
			checks++;
			assert.deepEqual(
				{ signals: await signals(), cte: await signals(cteTarget.id), metrics: await metrics() },
				beforeErasure,
			);
			checks++;
			await tx.delete(recommendationEvent).where(eq(recommendationEvent.id, first.id));
			assert.deepEqual(
				{ signals: await signals(), cte: await signals(cteTarget.id), metrics: await metrics() },
				beforeErasure,
			);
			checks++;
			const merged = await createMergedFixtureReference(tx);
			const lateObservation = event(merged.sourceId);
			assert.equal(
				(await recordRecommendationEvents(tx, new Authorization(undefined), [lateObservation]))
					.accepted,
				1,
			);
			checks++;
			const originalTarget = await tx.execute(sql`select value.target_publishing_id as target
				from recommendation_event event join reference_value value on value.id=event.target_reference_id
				where event.id=${lateObservation.id}::uuid`);
			assert.deepEqual(
				originalTarget.rows,
				[{ target: merged.sourceId }],
				"A readable late observation retains its original merged identity",
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
const storage = (
	await database.execute(sql`select count(*)::integer as rows,
	min(pg_column_size(event)) as min_tuple_bytes,max(pg_column_size(event)) as max_tuple_bytes,
	avg(pg_column_size(event))::float8 as mean_tuple_bytes
	from recommendation_event event join reference_value value on value.id=event.target_reference_id
	where ${inArray(sql`value.target_publishing_id`, batchTargets)}`)
).rows[0];
assert.equal(storage?.rows, 100);
checks++;
const shape = (
	await database.execute(sql`select
	(select count(*)::integer from pg_index where indrelid='recommendation_event'::regclass) as indexes,
	(select count(*)::integer from information_schema.columns where table_schema='public'
	and table_name='recommendation_event' and column_name like 'target_unit%') as old_columns`)
).rows[0];
assert.deepEqual(shape, { indexes: 5, old_columns: 0 });
checks++;

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
	"services/main/scripts/reference-merge-fixture.ts",
	"services/main/src/services/recommendations/events.ts",
	"services/main/src/services/recommendations/exclusions.ts",
	"services/main/src/services/units/reference-value.ts",
	"libraries/schema/src/postgres/discovery/recommendation.ts",
	"services/main/src/services/database/schema/postgres/participation-private-state.sql",
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
		storage,
		shape,
		maxDistinctTargets: 100,
		currentEventIntakeQualified: true,
		canonicalEventReferencesQualified: true,
		erasurePreservesAggregates: true,
		rollbackScenarios: true,
		orderedRaces: 5,
		eventTimeRecheckedAfterWait: true,
		fixtureHistoryRetained: true,
	}),
);
await database.$client.end();
await observability.shutdown();
