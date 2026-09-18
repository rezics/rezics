import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseExecutor } from "../database";
import { recommendationSnapshot as snapshots, recommendationSnapshotPartition as partitions } from "@rezics/schema/postgres/discovery/recommendation";
import { RecommendationPolicy as policy, RecommendationPolicyVersion } from "./policy";

export const RecommendationPartitionLeaseSchema = z.strictObject({
	snapshotId: z.uuid(), bucket: z.number().int().min(0).max(63), generation: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), token: z.uuid(),
});
type Lease = z.infer<typeof RecommendationPartitionLeaseSchema>;
function partitionKey(lease: Pick<Lease, "snapshotId" | "bucket">) {
	return and(eq(partitions.snapshotId, lease.snapshotId), eq(partitions.bucket, lease.bucket));
}

/** At most one building snapshot and one admission per policy/hour; the singleton lock covers only 64 control rows. */
export async function admitRecommendationSnapshot(database: DatabaseExecutor, minimumIntervalMs = 3_600_000) {
	z.number().int().min(3_600_000).max(Number.MAX_SAFE_INTEGER).parse(minimumIntervalMs);
	return database.transaction(async tx => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('recommendation-snapshot-admission',0))`);
		const [building] = await tx.select({ id: snapshots.id }).from(snapshots).where(eq(snapshots.state, "building")).limit(1).for("update");
		if (building) return building.id;
		const [recent] = await tx.select({ id: snapshots.id }).from(snapshots)
			.where(and(eq(snapshots.policyVersion, RecommendationPolicyVersion), sql`${snapshots.sourceWatermark}>clock_timestamp()-${minimumIntervalMs}*interval '1 millisecond'`))
			.orderBy(desc(snapshots.sourceWatermark)).limit(1);
		if (recent) return null;
		const retention = await tx.select({ id: snapshots.id }).from(snapshots)
			.where(and(eq(snapshots.active, false), sql`${snapshots.state}<>'building'`, sql`${snapshots.startedAt}<clock_timestamp()-${policy.snapshotRetentionHours}*interval '1 hour'`))
			.orderBy(snapshots.startedAt, snapshots.id).limit(17);
		if (retention.length > 16) return null;
		const [snapshot] = await tx.insert(snapshots).values({ policyVersion: RecommendationPolicyVersion,
			sourceWatermark: sql`date_trunc('hour',clock_timestamp(),'UTC')` }).onConflictDoNothing().returning({ id: snapshots.id });
		if (!snapshot) return null;
		await tx.insert(partitions).values(Array.from({ length: policy.buildPartitions }, (_, bucket) => ({ snapshotId: snapshot.id, bucket })));
		return snapshot.id;
	});
}

/** SKIP LOCKED distributes physical signal partitions; reclaiming a lease never rewinds committed progress. */
export async function claimRecommendationPartition(database: DatabaseExecutor, snapshotId: string): Promise<Lease | null> {
	z.uuid().parse(snapshotId);
	return database.transaction(async tx => {
		const [snapshot] = await tx.select({ id: snapshots.id }).from(snapshots)
			.where(and(eq(snapshots.id, snapshotId), eq(snapshots.state, "building"), sql`${snapshots.startedAt}>clock_timestamp()-${policy.buildDeadlineMs}*interval '1 millisecond'`)).limit(1);
		if (!snapshot) return null;
		const [candidate] = await tx.select().from(partitions).where(and(eq(partitions.snapshotId, snapshotId),
			or(eq(partitions.state, "pending"), and(eq(partitions.state, "working"), sql`${partitions.leaseExpiresAt}<=clock_timestamp()`)),
			sql`${partitions.nextAttemptAt}<=clock_timestamp()`))
			.orderBy(partitions.bucket).limit(1).for("update", { skipLocked: true });
		if (!candidate) return null;
		const token = crypto.randomUUID();
		const [leased] = await tx.update(partitions).set({ state: "working", leaseToken: token,
			leaseExpiresAt: sql`clock_timestamp()+${policy.buildLeaseMs}*interval '1 millisecond'`, generation: candidate.generation + 1 })
			.where(partitionKey(candidate)).returning({ generation: partitions.generation });
		if (!leased) throw new Error("Recommendation partition claim disappeared");
		return RecommendationPartitionLeaseSchema.parse({ snapshotId, bucket: candidate.bucket, generation: leased.generation, token });
	});
}

/** One bounded score batch and its exact cursor commit atomically under the current lease. */
export async function advanceRecommendationPartition(database: DatabaseExecutor, input: Lease) {
	const lease = RecommendationPartitionLeaseSchema.parse(input);
	return database.transaction(async tx => {
		await tx.execute(sql`select set_config('transaction_timeout',${String(policy.buildTransactionMs)},true),set_config('statement_timeout',${String(policy.buildTransactionMs - 1000)},true),set_config('lock_timeout','3000',true)`);
		const [partition] = await tx.select().from(partitions).where(and(partitionKey(lease), eq(partitions.generation, lease.generation),
			eq(partitions.leaseToken, lease.token), eq(partitions.state, "working"), sql`${partitions.leaseExpiresAt}>clock_timestamp()`)).limit(1).for("update");
		if (!partition) return { status: "stale" as const, scannedRows: 0 };
		const [snapshot] = await tx.select().from(snapshots).where(and(eq(snapshots.id, lease.snapshotId), eq(snapshots.state, "building"))).limit(1);
		if (!snapshot?.sourceWatermark) return { status: "stale" as const, scannedRows: 0 };
		// Both signal and score tables use the reviewed 64-way native HASH(unit_id) layout.
		// Naming the checked physical child gives exact pruning without approximating PostgreSQL's hash in application code.
		const source = sql.identifier(`recommendation_unit_signal_hourly_p${String(lease.bucket).padStart(2, "0")}`);
		const result = await tx.execute<{ count: number; bucket: string | null; id: string | null; kind: string | null }>(sql`
		 with batch as materialized (
		  select unit_id,bucket_start,kind,weight from ${source}
		  where bucket_start>=${snapshot.sourceWatermark}::timestamptz-${policy.bestWindowDays}*interval '1 day'
		   and bucket_start<${snapshot.sourceWatermark}::timestamptz and weight>0
		   ${partition.afterBucketStart && partition.afterUnitId && partition.afterKind
				? sql`and (bucket_start,unit_id,kind)>(${partition.afterBucketStart}::timestamptz,${partition.afterUnitId}::uuid,${partition.afterKind}::recommendation_signal_kind)` : sql``}
		  order by bucket_start,unit_id,kind limit ${policy.buildBatchSize}
		 ), positive as materialized (
		  select unit_id,sum(weight*exp(-ln(2)*extract(epoch from (${snapshot.sourceWatermark}::timestamptz-bucket_start))/${policy.bestHalfLifeHours * 3600}))::double precision score
		  from batch group by unit_id
		 ), written as (
		  insert into unit_best_score(snapshot_id,unit_id,unit_owner,unit_shape,score,unit_updated_at)
		  select ${lease.snapshotId}::uuid,positive.unit_id,state.owner,state.shape,positive.score,state.updated_at
		  from positive cross join lateral public.read_unit_state(positive.unit_id,false) state
		  where state.status='published' and state.visibility='public' and state.moderation_status='approved' and state.deleted_at is null and positive.score>0
		  on conflict(snapshot_id,unit_id) do update set score=unit_best_score.score+excluded.score,
		   unit_updated_at=excluded.unit_updated_at,unit_owner=excluded.unit_owner,unit_shape=excluded.unit_shape
		 ), boundary as (select bucket_start,unit_id,kind from batch order by bucket_start desc,unit_id desc,kind desc limit 1)
		 select (select count(*)::integer from batch) count, boundary.bucket_start::text bucket,boundary.unit_id::text id,boundary.kind::text kind
		 from (values(1)) anchor(n) left join boundary on true
		`);
		const row = result.rows[0];
		if (!row || (row.count > 0 && (!row.bucket || !row.id || !row.kind))) throw new Error("Recommendation checkpoint boundary is incomplete");
		const done = row.count < policy.buildBatchSize;
		const [advanced] = await tx.update(partitions).set({ state: done ? "done" : "pending", leaseToken: null, leaseExpiresAt: null,
			afterBucketStart: row.bucket ? new Date(row.bucket) : partition.afterBucketStart,
			afterUnitId: row.id ?? partition.afterUnitId, afterKind: row.kind ?? partition.afterKind,
			scannedRows: partition.scannedRows + BigInt(row.count), nextAttemptAt: sql`clock_timestamp()`, error: null, failures: 0 })
			.where(and(partitionKey(lease), eq(partitions.generation, lease.generation), eq(partitions.leaseToken, lease.token), sql`${partitions.leaseExpiresAt}>clock_timestamp()`))
			.returning({ bucket: partitions.bucket });
		if (!advanced) throw new Error("Recommendation lease expired before score publication");
		return { status: done ? "done" as const : "advanced" as const, scannedRows: row.count };
	});
}

export async function failRecommendationPartition(database: DatabaseExecutor, input: Lease, cause: unknown) {
	const lease = RecommendationPartitionLeaseSchema.parse(input);
	const message = cause instanceof Error ? cause.message.slice(0, 400) : "Recommendation batch failed";
	await database.transaction(async tx => {
		const [current] = await tx.select().from(partitions).where(and(partitionKey(lease), eq(partitions.generation, lease.generation),
			eq(partitions.leaseToken, lease.token), eq(partitions.state, "working"))).limit(1).for("update");
		if (!current) return;
		const failures = current.failures + 1;
		await tx.update(partitions).set({ state: failures >= policy.buildMaximumFailures ? "failed" : "pending",
			failures, error: message, leaseToken: null, leaseExpiresAt: null,
			nextAttemptAt: sql`clock_timestamp()+${Math.min(60_000, 1000 * 2 ** failures)}*interval '1 millisecond'` }).where(partitionKey(lease));
	});
}

/** Activation sees only 64 control rows. A partial, failed or expired build cannot replace the ready snapshot. */
export async function finalizeRecommendationSnapshot(database: DatabaseExecutor, snapshotId: string) {
	z.uuid().parse(snapshotId);
	return database.transaction(async tx => {
		const [snapshot] = await tx.select().from(snapshots).where(eq(snapshots.id, snapshotId)).limit(1).for("update");
		if (!snapshot) return "missing" as const;
		if (snapshot.state !== "building") return snapshot.state;
		const rows = await tx.select({ state: partitions.state }).from(partitions).where(eq(partitions.snapshotId, snapshotId)).limit(65);
		const expired = await tx.select({ id: snapshots.id }).from(snapshots)
			.where(and(eq(snapshots.id, snapshotId), sql`${snapshots.startedAt}<=clock_timestamp()-${policy.buildDeadlineMs}*interval '1 millisecond'`)).limit(1);
		if (rows.length !== policy.buildPartitions || rows.some(row => row.state === "failed") || expired.length) {
			await tx.update(snapshots).set({ state: "failed", completedAt: sql`clock_timestamp()`, error: "Partition build failed or exceeded its execution deadline" }).where(eq(snapshots.id, snapshotId));
			return "failed" as const;
		}
		if (rows.some(row => row.state !== "done")) return "building" as const;
		await tx.update(snapshots).set({ active: false }).where(eq(snapshots.active, true));
		await tx.update(snapshots).set({ active: true, state: "ready", completedAt: sql`clock_timestamp()`, error: null }).where(eq(snapshots.id, snapshotId));
		return "ready" as const;
	});
}

/** One worker tick touches at most four partitions. More processes may claim different partitions concurrently. */
export async function dispatchRecommendationBuild(database: DatabaseExecutor, minimumIntervalMs = 3_600_000) {
	const snapshotId = await admitRecommendationSnapshot(database, minimumIntervalMs);
	if (!snapshotId) return { snapshotId: null, state: "idle" as const, scannedRows: 0 };
	const work = await Promise.all(Array.from({ length: policy.buildConcurrency }, async () => {
		const lease = await claimRecommendationPartition(database, snapshotId);
		if (!lease) return 0;
		try { return (await advanceRecommendationPartition(database, lease)).scannedRows; }
		catch (cause) { await failRecommendationPartition(database, lease, cause); return 0; }
	}));
	return { snapshotId, state: await finalizeRecommendationSnapshot(database, snapshotId), scannedRows: work.reduce((total, count) => total + count, 0) };
}
