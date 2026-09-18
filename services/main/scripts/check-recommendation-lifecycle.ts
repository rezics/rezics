import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { and, eq, inArray, sql } from "drizzle-orm";
import { database } from "../src/services/database";
import { users } from "@rezics/schema/postgres/identity/auth";
import {
	recommendationSnapshot,
	recommendationSnapshotPartition,
	unitBestScore,
} from "@rezics/schema/postgres/discovery/recommendation";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { createCatalogIdentity } from "../src/services/catalog/storage";
import { runWithParticipationAuthority } from "../src/services/participation/policy";
import {
	admitRecommendationSnapshot,
	claimRecommendationPartition,
	advanceRecommendationPartition,
	failRecommendationPartition,
	finalizeRecommendationSnapshot,
} from "../src/services/recommendations/build-partitions";
import {
	purgeRecommendationData,
	dispatchRecommendationRefresh,
	getRecommendationHealth,
} from "../src/services/recommendations/worker";
import {
	RecommendationPolicy,
	RecommendationPolicyVersion,
} from "../src/services/recommendations/policy";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
		url.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(url.pathname),
	"Lifecycle checks require a disposable Atlas database",
);
let checks = 0;
function same(actual: unknown, expected: unknown) {
	assert.deepEqual(actual, expected);
	checks++;
}
const [prior] = await database
	.select({ id: recommendationSnapshot.id })
	.from(recommendationSnapshot)
	.limit(1);
assert.equal(prior, undefined, "Prepare empty recommendation lanes before lifecycle qualification");
const {
	rows: [clock],
} = await database.execute<{ hour: Date }>(
	sql`select date_trunc('hour',clock_timestamp(),'UTC') as hour`,
);
assert.ok(clock);
const hour = new Date(clock.hour),
	hourMs = hour.getTime();
async function newSnapshot(offsetHours: number, ageHours = 0, count = 64) {
	return database.transaction(async (tx) => {
		const [snapshot] = await tx
			.insert(recommendationSnapshot)
			.values({
				policyVersion: RecommendationPolicyVersion,
				sourceWatermark: new Date(hourMs - offsetHours * 3600000),
				startedAt: sql`clock_timestamp()-${ageHours}*interval '1 hour'`,
			})
			.returning();
		assert.ok(snapshot);
		if (count)
			await tx
				.insert(recommendationSnapshotPartition)
				.values(
					Array.from({ length: count }, (_, bucket) => ({ snapshotId: snapshot.id, bucket })),
				);
		return snapshot;
	});
}
async function finish(id: string) {
	for (let page = 0; page < 128; page++) {
		const lease = await claimRecommendationPartition(database, id);
		if (!lease) return finalizeRecommendationSnapshot(database, id);
		const result = await advanceRecommendationPartition(database, lease);
		assert.ok(result.status === "done" || result.status === "advanced");
	}
	throw new Error("Lifecycle fixture exceeded its page budget");
}
async function activeId() {
	const [row] = await database
		.select({ id: recommendationSnapshot.id })
		.from(recommendationSnapshot)
		.where(eq(recommendationSnapshot.active, true));
	return row?.id;
}
const reference = await database.transaction(async (tx) => {
	const [account] = await tx
		.insert(users)
		.values({
			name: "Recommendation lifecycle fixture",
			email: `${crypto.randomUUID()}@example.invalid`,
			emailVerified: true,
		})
		.returning();
	assert.ok(account);
	const self = await ensureSelfEntityInTransaction(tx, account);
	return runWithParticipationAuthority(
		{
			principal: { kind: "auth", authUserId: account.id },
			actingEntityId: self.id,
			authorizationRevision: self.authorizationRevision,
		},
		() =>
			createCatalogIdentity(
				tx,
				{ owner: "publishing", shape: "work", status: "published", visibility: "public" },
				account.id,
			),
	);
});
await database.execute(sql`insert into recommendation_unit_signal_hourly(unit_id,bucket_start,kind,signal_count,weight) values
  (${reference.id}::uuid,${hour}::timestamptz-interval '3 hours','open',1,1),
  (${reference.id}::uuid,${hour}::timestamptz-interval '7 days','open',1,1),
  (${reference.id}::uuid,${hour}::timestamptz-interval '7 days 1 hour','open',1,1)`);
const sentinel = await newSnapshot(2);
same(await finish(sentinel.id), "ready");
same(await activeId(), sentinel.id);
same(
	(await database.select().from(unitBestScore).where(eq(unitBestScore.snapshotId, sentinel.id)))
		.length,
	1,
);
// A build admitted in this hour still needs the entire oldest UTC-hour bucket.
await purgeRecommendationData(new Date(hourMs + 30 * 60000));
const {
	rows: [retained],
} = await database.execute<{
	n: number;
}>(sql`select count(*)::integer as n from recommendation_unit_signal_hourly
  where unit_id=${reference.id}::uuid and bucket_start=${hour}::timestamptz-interval '7 days'`);
same(retained?.n, 1);
const {
	rows: [removed],
} = await database.execute<{
	n: number;
}>(sql`select count(*)::integer as n from recommendation_unit_signal_hourly
  where unit_id=${reference.id}::uuid and bucket_start=${hour}::timestamptz-interval '7 days 1 hour'`);
same(removed?.n, 0);
same(await activeId(), sentinel.id);
// A still-building historical cut protects its own older boundary.
const protectedBuild = await newSnapshot(1);
await database.execute(sql`insert into recommendation_unit_signal_hourly(unit_id,bucket_start,kind,signal_count,weight)
	values(${reference.id}::uuid,${hour}::timestamptz-interval '7 days 1 hour','open',1,1)`);
await purgeRecommendationData(new Date(hourMs + 30 * 60000));
const {
	rows: [protectedSignal],
} = await database.execute<{
	n: number;
}>(sql`select count(*)::integer as n from recommendation_unit_signal_hourly
	where unit_id=${reference.id}::uuid and bucket_start=${hour}::timestamptz-interval '7 days 1 hour'`);
same(protectedSignal?.n, 1);
// A caller's later clock cannot authorize pruning while database finalization still reports building.
await purgeRecommendationData(new Date(Date.now() + 3 * 3600000));
const [stillBuilding] = await database
	.select()
	.from(recommendationSnapshot)
	.where(eq(recommendationSnapshot.id, protectedBuild.id));
same(stillBuilding?.state, "building");
const {
	rows: [protectedAfterFinalization],
} = await database.execute<{
	n: number;
}>(sql`select count(*)::integer as n from recommendation_unit_signal_hourly
	where unit_id=${reference.id}::uuid and bucket_start=${hour}::timestamptz-interval '7 days 1 hour'`);
same(protectedAfterFinalization?.n, 1);
same(await finish(protectedBuild.id), "ready");
const priorScores = await database
	.select()
	.from(unitBestScore)
	.where(eq(unitBestScore.snapshotId, protectedBuild.id));
const expired = await newSnapshot(3, 3);
same(await claimRecommendationPartition(database, expired.id), null);
same(await finalizeRecommendationSnapshot(database, expired.id), "failed");
same(await activeId(), protectedBuild.id);
const incomplete = await newSnapshot(4, 0, 63);
same(await finalizeRecommendationSnapshot(database, incomplete.id), "failed");
same(await activeId(), protectedBuild.id);
const exhausted = await newSnapshot(5);
let previousLease: Awaited<ReturnType<typeof claimRecommendationPartition>> = null;
for (let failure = 1; failure <= RecommendationPolicy.buildMaximumFailures; failure++) {
	const lease = await claimRecommendationPartition(database, exhausted.id);
	assert.ok(lease);
	same(lease.bucket, 0);
	same(lease.generation, failure);
	if (previousLease) {
		await failRecommendationPartition(
			database,
			previousLease,
			new Error("Stale failure acknowledgement"),
		);
		const [current] = await database
			.select()
			.from(recommendationSnapshotPartition)
			.where(
				and(
					eq(recommendationSnapshotPartition.snapshotId, exhausted.id),
					eq(recommendationSnapshotPartition.bucket, 0),
				),
			);
		same(current?.leaseToken, lease.token);
		same(current?.failures, failure - 1);
	}
	const {
		rows: [before],
	} = await database.execute<{ at: Date }>(sql`select clock_timestamp() as at`);
	assert.ok(before);
	await failRecommendationPartition(database, lease, new Error("Injected lifecycle failure"));
	const {
		rows: [after],
	} = await database.execute<{ at: Date }>(sql`select clock_timestamp() as at`);
	assert.ok(after);
	const [failed] = await database
		.select()
		.from(recommendationSnapshotPartition)
		.where(
			and(
				eq(recommendationSnapshotPartition.snapshotId, exhausted.id),
				eq(recommendationSnapshotPartition.bucket, 0),
			),
		);
	assert.ok(failed);
	same(failed.failures, failure);
	same(failed.state, failure === 12 ? "failed" : "pending");
	const delay = Math.min(60000, 1000 * 2 ** failure);
	assert.ok(
		failed.nextAttemptAt.getTime() >= new Date(before.at).getTime() + delay - 1 &&
			failed.nextAttemptAt.getTime() <= new Date(after.at).getTime() + delay + 1,
	);
	checks++;
	await failRecommendationPartition(
		database,
		lease,
		new Error("Duplicate failure acknowledgement"),
	);
	const [duplicate] = await database
		.select()
		.from(recommendationSnapshotPartition)
		.where(
			and(
				eq(recommendationSnapshotPartition.snapshotId, exhausted.id),
				eq(recommendationSnapshotPartition.bucket, 0),
			),
		);
	same(duplicate?.failures, failure);
	previousLease = lease;
	if (failure < 12) {
		// Scheduling acceleration follows verification of the actual backoff; it changes no receipt, lease generation or failure count.
		await database
			.update(recommendationSnapshotPartition)
			.set({ nextAttemptAt: sql`clock_timestamp()` })
			.where(
				and(
					eq(recommendationSnapshotPartition.snapshotId, exhausted.id),
					eq(recommendationSnapshotPartition.bucket, 0),
				),
			);
	}
}
assert.ok(previousLease);
same((await advanceRecommendationPartition(database, previousLease)).status, "stale");
same(await finalizeRecommendationSnapshot(database, exhausted.id), "failed");
same(await activeId(), protectedBuild.id);
same(
	await database
		.select()
		.from(unitBestScore)
		.where(eq(unitBestScore.snapshotId, protectedBuild.id)),
	priorScores,
);

const retiredIds: string[] = [];
for (let index = 0; index < 16; index++) {
	const retired = await newSnapshot(10 + index, 8, 0);
	same(await finalizeRecommendationSnapshot(database, retired.id), "failed");
	retiredIds.push(retired.id);
}
const rollbackAdmission = new Error("rollback sixteen-row admission probe");
try {
	await database.transaction(async (tx) => {
		assert.ok(await admitRecommendationSnapshot(tx));
		checks++;
		throw rollbackAdmission;
	});
} catch (error) {
	if (error !== rollbackAdmission) throw error;
}
const seventeenth = await newSnapshot(26, 8, 0);
same(await finalizeRecommendationSnapshot(database, seventeenth.id), "failed");
retiredIds.push(seventeenth.id);
same(await admitRecommendationSnapshot(database), null);
await purgeRecommendationData();
const retainedRetired = await database
	.select({ id: recommendationSnapshot.id })
	.from(recommendationSnapshot)
	.where(inArray(recommendationSnapshot.id, retiredIds));
same(retainedRetired.length, 13);
same(await activeId(), protectedBuild.id);
same(
	await database
		.select()
		.from(unitBestScore)
		.where(eq(unitBestScore.snapshotId, protectedBuild.id)),
	priorScores,
);

const firstTick = await dispatchRecommendationRefresh();
assert.ok(firstTick.snapshotId);
same(firstTick.state, "building");
let [done] = await database
	.select({ n: sql<number>`count(*)::integer` })
	.from(recommendationSnapshotPartition)
	.where(
		and(
			eq(recommendationSnapshotPartition.snapshotId, firstTick.snapshotId),
			eq(recommendationSnapshotPartition.state, "done"),
		),
	);
same(done?.n, 4);
same(await activeId(), protectedBuild.id);
let ticks = 1;
for (; ticks < 32; ticks++) {
	const result = await dispatchRecommendationRefresh();
	same(result.snapshotId, firstTick.snapshotId);
	if (result.state === "ready") {
		ticks++;
		break;
	}
	same(result.state, "building");
}
same(ticks, 16);
same(await activeId(), firstTick.snapshotId);
[done] = await database
	.select({ n: sql<number>`count(*)::integer` })
	.from(recommendationSnapshotPartition)
	.where(
		and(
			eq(recommendationSnapshotPartition.snapshotId, firstTick.snapshotId),
			eq(recommendationSnapshotPartition.state, "done"),
		),
	);
same(done?.n, 64);
same((await dispatchRecommendationRefresh()).state, "idle");
const [active] = await database
	.select()
	.from(recommendationSnapshot)
	.where(eq(recommendationSnapshot.id, firstTick.snapshotId));
assert.ok(active?.completedAt);
same(
	(
		await getRecommendationHealth(
			new Date(active.completedAt.getTime() + RecommendationPolicy.snapshotStaleHours * 3600000),
		)
	).ready,
	true,
);
same(
	(
		await getRecommendationHealth(
			new Date(
				active.completedAt.getTime() + RecommendationPolicy.snapshotStaleHours * 3600000 + 1,
			),
		)
	).ready,
	false,
);
const activeScores = await database
	.select()
	.from(unitBestScore)
	.where(eq(unitBestScore.snapshotId, active.id));
await purgeRecommendationData(new Date(Date.now() + 24 * 3600000));
same(await activeId(), active.id);
same(
	await database.select().from(unitBestScore).where(eq(unitBestScore.snapshotId, active.id)),
	activeScores,
);
const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-recommendation-lifecycle.ts",
	"services/main/src/services/recommendations/worker.ts",
	"services/main/src/services/recommendations/build-partitions.ts",
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
				sql`select version() as postgres,current_setting('TimeZone') as timezone`,
			)
		).rows[0],
		checks,
		ticks,
		upcomingHourlyWindowRetained: true,
		buildingWindowRetained: true,
		expiredAndFailedBuildsPreserveActive: true,
		failureExhaustionAndStaleAcknowledgements: true,
		retentionBackpressureBoundary: true,
		maintenanceDeletionBudget: 4,
		healthBoundaryQualified: true,
		activeSnapshotSurvivesRetention: true,
		fixtureHistoryRetained: true,
	}),
);
await database.$client.end();
