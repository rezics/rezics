import { and, desc, eq, lt, ne, sql } from "drizzle-orm";

import { database, type DatabaseTransaction, withDatabaseSession } from "../database";
import { recommendationSnapshot, unitBestScore } from "../database/schema";
import { RecommendationPolicy, RecommendationPolicyVersion } from "./policy";

/**
 * Materializes the sparse, shared `best` sort key for one immutable snapshot.
 *
 * Only Units with positive recent signal are written. Zero-score Units stay out
 * of this table and are served directly from the public Unit updated-at index.
 * This makes refresh cost proportional to recent activity, not catalogue size.
 */
async function buildUnitBestScores(
	tx: DatabaseTransaction,
	snapshotId: string,
	sourceWatermark: Date,
) {
	const halfLifeSeconds = RecommendationPolicy.bestHalfLifeHours * 3_600;
	await tx.execute(sql`
		with positive_score as (
			select coalesce(relationship.main_unit_id, signal.unit_id) as unit_id,
				sum(
					signal.weight * exp(
						-ln(2) * extract(epoch from (
							${sourceWatermark}::timestamptz - signal.bucket_start
						)) / ${halfLifeSeconds}
					)
				)::double precision as score
			from recommendation_unit_signal_hourly signal
			left join unit_variant relationship
				on relationship.variant_unit_id = signal.unit_id
			where signal.bucket_start >= ${sourceWatermark}::timestamptz
					- ${RecommendationPolicy.bestWindowDays} * interval '1 day'
				and signal.bucket_start <= ${sourceWatermark}::timestamptz
				and signal.weight > 0
			group by coalesce(relationship.main_unit_id, signal.unit_id)
			having sum(signal.weight) > 0
		)
		insert into ${unitBestScore} (
			snapshot_id, unit_id, unit_kind, score, unit_updated_at
		)
		select ${snapshotId}::uuid, positive_score.unit_id, discovery.kind,
			positive_score.score, discovery.updated_at
		from positive_score
		join unit discovery on discovery.id = positive_score.unit_id
		where discovery.status = 'published'
			and discovery.visibility = 'public'
			and discovery.moderation_status = 'approved'
			and discovery.deleted_at is null
	`);
}

export async function refreshRecommendationSnapshot(): Promise<string | null> {
	return withDatabaseSession(async (session) => {
		const lock = await session.execute<{ acquired: boolean }>(
			sql`select pg_try_advisory_lock(hashtextextended('recommendation-refresh', 0)) AS acquired`,
		);
		if (!lock.rows[0]?.acquired) return null;
		let snapshotId: string | null = null;
		try {
			const sourceWatermark = new Date();
			const [snapshot] = await session
				.insert(recommendationSnapshot)
				.values({
					policyVersion: RecommendationPolicyVersion,
					sourceWatermark,
				})
				.returning({ id: recommendationSnapshot.id });
			if (!snapshot) throw new Error("Recommendation snapshot insertion returned no row");
			snapshotId = snapshot.id;
			await session.transaction((tx) => buildUnitBestScores(tx, snapshot.id, sourceWatermark));

			await session.transaction(async (tx) => {
				const completedAt = new Date();
				await tx
					.update(recommendationSnapshot)
					.set({ active: false })
					.where(eq(recommendationSnapshot.active, true));
				await tx
					.update(recommendationSnapshot)
					.set({ state: "ready", active: true, completedAt, error: null })
					.where(eq(recommendationSnapshot.id, snapshot.id));
			});
			return snapshot.id;
		} catch (error) {
			if (snapshotId)
				await session
					.update(recommendationSnapshot)
					.set({
						state: "failed",
						active: false,
						completedAt: new Date(),
						error: error instanceof Error ? error.message.slice(0, 2_000) : "Unknown refresh error",
					})
					.where(eq(recommendationSnapshot.id, snapshotId));
			throw error;
		} finally {
			await session.execute(
				sql`select pg_advisory_unlock(hashtextextended('recommendation-refresh', 0))`,
			);
		}
	});
}

export async function aggregateRecommendationMetrics() {
	await database.execute(sql`
		insert into recommendation_metric_daily (
			day, surface, policy_version, impressions, opens, dwell_30s, not_interested
		)
		select occurred_at::date, surface, policy_version,
			count(*) filter (where type = 'impression'),
			count(*) filter (where type = 'open'),
			count(*) filter (where type = 'dwell_30s'),
			count(*) filter (where type = 'not_interested')
		from recommendation_event
		where surface is not null and policy_version is not null
			and occurred_at >= current_date - interval '2 days'
		group by occurred_at::date, surface, policy_version
		on conflict (day, surface, policy_version) do update set
			impressions = excluded.impressions,
			opens = excluded.opens,
			dwell_30s = excluded.dwell_30s,
			not_interested = excluded.not_interested
	`);
}

export async function purgeRecommendationData(now = new Date()) {
	const eventBoundary = new Date(
		now.getTime() - RecommendationPolicy.eventRetentionDays * 86_400_000,
	);
	const snapshotBoundary = new Date(
		now.getTime() - RecommendationPolicy.snapshotRetentionHours * 3_600_000,
	);
	const signalBoundary = new Date(
		now.getTime() - RecommendationPolicy.signalRetentionDays * 86_400_000,
	);
	await database
		.delete(recommendationSnapshot)
		.where(
			and(
				ne(recommendationSnapshot.active, true),
				lt(recommendationSnapshot.startedAt, snapshotBoundary),
			),
		);
	await database.execute(
		sql`delete from recommendation_event where occurred_at < ${eventBoundary}`,
	);
	await database.execute(
		sql`delete from recommendation_unit_signal_hourly where bucket_start < ${signalBoundary}`,
	);
}

export async function getRecommendationHealth(now = new Date()) {
	const [snapshot] = await database
		.select({
			id: recommendationSnapshot.id,
			policyVersion: recommendationSnapshot.policyVersion,
			completedAt: recommendationSnapshot.completedAt,
		})
		.from(recommendationSnapshot)
		.where(eq(recommendationSnapshot.active, true))
		.orderBy(desc(recommendationSnapshot.completedAt))
		.limit(1);
	const ageMs = snapshot?.completedAt ? now.getTime() - snapshot.completedAt.getTime() : null;
	return {
		ready: ageMs !== null && ageMs <= RecommendationPolicy.snapshotStaleHours * 3_600_000,
		snapshotId: snapshot?.id ?? null,
		policyVersion: snapshot?.policyVersion ?? RecommendationPolicyVersion,
		ageMs,
	};
}
