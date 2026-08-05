import { and, desc, eq, gt, lt, ne, sql } from "drizzle-orm";

import { database, type DatabaseTransaction, withDatabaseSession } from "../database";
import { recommendationSnapshot, unit } from "../database/schema";
import { WorkPolicy } from "../performance/policy";
import { RecommendationPolicy, RecommendationPolicyVersion } from "./policy";

async function buildUnitStats(tx: DatabaseTransaction, snapshotId: string) {
	await tx.execute(sql`
		WITH unit_identity AS (
			SELECT source.id AS source_unit_id,
				coalesce(relationship.main_unit_id, source.id) AS discovery_unit_id
			FROM unit source
			LEFT JOIN unit_variant relationship
				ON relationship.variant_unit_id = source.id
		), event_stats AS (
			SELECT unit_id,
				sum(signal_count) FILTER (WHERE kind = 'impression') AS impressions,
				sum(signal_count) FILTER (WHERE kind = 'open') AS opens,
				sum(signal_count) FILTER (WHERE kind = 'dwell_30s') AS dwell30s
			FROM recommendation_unit_signal_hourly
			WHERE bucket_start >= now() - ${RecommendationPolicy.eventRetentionDays} * interval '1 day'
			GROUP BY unit_id
		), window_stats AS (
			SELECT unit_id,
				coalesce(sum(weight) FILTER (WHERE bucket_start >= now() - interval '6 hours'), 0) AS engagement6h,
				coalesce(sum(weight) FILTER (WHERE bucket_start >= now() - interval '24 hours'), 0) AS engagement24h,
				coalesce(sum(weight), 0) AS engagement7d
			FROM recommendation_unit_signal_hourly
			WHERE bucket_start >= now() - interval '7 days' AND weight > 0
			GROUP BY unit_id
		), grouped AS (
			SELECT identity.discovery_unit_id AS unit_id,
				coalesce(sum(es.impressions), 0) AS impressions,
				coalesce(sum(es.opens), 0) AS opens,
				coalesce(sum(es.dwell30s), 0) AS dwell30s,
				coalesce(sum(current_stat.upvotes), 0) AS upvotes,
				coalesce(sum(current_stat.downvotes), 0) AS downvotes,
				coalesce(sum(current_stat.replies), 0) AS replies,
				coalesce(sum(current_stat.favorites), 0) AS favorites,
				coalesce(sum(current_stat.shares), 0) AS shares,
				coalesce(sum(current_stat.high_scores), 0) AS high_scores,
				coalesce(sum(current_stat.active_progress), 0) AS active_progress,
				coalesce(sum(current_stat.completions), 0) AS completions,
				coalesce(sum(current_stat.negative_progress), 0) AS negative_progress,
				coalesce(sum(ws.engagement6h), 0) AS engagement6h,
				coalesce(sum(ws.engagement24h), 0) AS engagement24h,
				coalesce(sum(ws.engagement7d), 0) AS engagement7d
			FROM unit_identity identity
			JOIN unit discovery ON discovery.id = identity.discovery_unit_id
			LEFT JOIN event_stats es ON es.unit_id = identity.source_unit_id
			LEFT JOIN unit_engagement_stat current_stat
				ON current_stat.unit_id = identity.source_unit_id
			LEFT JOIN window_stats ws ON ws.unit_id = identity.source_unit_id
			WHERE discovery.status = 'published' AND discovery.visibility = 'public'
				AND discovery.moderation_status = 'approved' AND discovery.deleted_at IS NULL
			GROUP BY identity.discovery_unit_id
		)
		INSERT INTO recommendation_unit_stat (
				snapshot_id, unit_id, context_realm_id, impressions, opens, dwell_30s,
			upvotes, downvotes, replies, favorites, shares, high_scores,
			active_progress, completions, negative_progress,
				engagement_6h, engagement_24h, engagement_7d
		)
		SELECT ${snapshotId}::uuid, grouped.unit_id, NULL,
			grouped.impressions, grouped.opens, grouped.dwell30s,
			grouped.upvotes, grouped.downvotes, grouped.replies, grouped.favorites,
			grouped.shares, grouped.high_scores, grouped.active_progress,
			grouped.completions, grouped.negative_progress, grouped.engagement6h,
			grouped.engagement24h, grouped.engagement7d
		FROM grouped
	`);
}

async function buildProfileInterests(tx: DatabaseTransaction, snapshotId: string) {
	await tx.execute(sql`
		WITH decayed AS (
			SELECT profile_id, unit_id,
				sum(weight * exp(-ln(2) * extract(epoch FROM (now() - bucket_start)) / (${RecommendationPolicy.interestHalfLifeDays} * 86400))) AS weight
			FROM recommendation_profile_signal_hourly
			WHERE weight <> 0
				AND bucket_start >= now() - ${RecommendationPolicy.interestMaxAgeDays} * interval '1 day'
			GROUP BY profile_id, unit_id
		), resolved AS (
			SELECT d.profile_id, coalesce(relationship.main_unit_id, d.unit_id) AS unit_id,
				sum(d.weight) AS weight
			FROM decayed d
			LEFT JOIN unit_variant relationship ON relationship.variant_unit_id = d.unit_id
			GROUP BY d.profile_id, coalesce(relationship.main_unit_id, d.unit_id)
		), ranked AS (
			SELECT resolved.profile_id, resolved.unit_id, resolved.weight,
				row_number() OVER (
					PARTITION BY resolved.profile_id
					ORDER BY resolved.weight DESC, resolved.unit_id
				) AS rank
			FROM resolved
			JOIN profile_preference preference ON preference.profile_id = resolved.profile_id
			LEFT JOIN recommendation_exclusion exclusion
				ON exclusion.profile_id = resolved.profile_id
				AND exclusion.unit_id = resolved.unit_id
			WHERE preference.personalized_feed
				AND resolved.weight > 0 AND exclusion.unit_id IS NULL
		)
		INSERT INTO recommendation_profile_interest (snapshot_id, profile_id, unit_id, weight, rank)
		SELECT ${snapshotId}::uuid, profile_id, unit_id, weight, rank::int
		FROM ranked WHERE rank <= ${RecommendationPolicy.maxInterestsPerProfile}
	`);
}

async function buildUnitEdges(
	tx: DatabaseTransaction,
	snapshotId: string,
	sourceUnitIds: readonly string[],
) {
	if (
		sourceUnitIds.length < 1 ||
		sourceUnitIds.length > WorkPolicy.recommendation.maxRefreshBatchUnits
	)
		throw new RangeError("Recommendation edge batch exceeds the server-owned limit");
	const sourceUnitIdList = sql.join(
		sourceUnitIds.map((id) => sql`${id}::uuid`),
		sql`, `,
	);
	await tx.execute(sql`
		WITH structural_signal AS (
			SELECT unit_id AS source_id, 'tag'::text AS kind, tag_id AS signal_id, 1.0 AS weight
			FROM unit_tag
			WHERE unit_id IN (${sourceUnitIdList})
			UNION ALL
			SELECT source_unit_id, 'credit', credited_unit_id, 1.25
			FROM credit_attribution
			WHERE source_unit_id IN (${sourceUnitIdList})
			UNION ALL
			SELECT unit_id, 'subject', entity_id, 1.25
			FROM subject_association
			WHERE unit_id IN (${sourceUnitIdList})
			UNION ALL
			SELECT release_unit_id, 'series', series_id, 2.0
			FROM series_release
			WHERE release_unit_id IN (${sourceUnitIdList})
			UNION ALL
			SELECT id, 'post-subject', subject_unit_id, 2.0
			FROM post
			WHERE id IN (${sourceUnitIdList}) AND subject_unit_id IS NOT NULL
		), bounded_signal AS (
			SELECT source_id, kind, signal_id, weight
			FROM (
				SELECT structural_signal.*,
					row_number() OVER (
						PARTITION BY source_id
						ORDER BY weight DESC, kind, signal_id
					) AS signal_rank
				FROM structural_signal
			) ranked_signal
			WHERE signal_rank <= ${RecommendationPolicy.maxStructuralSignals}
		), bounded_peer AS (
			SELECT signal.source_id, peer.target_id, signal.weight,
				peer.peer_count
			FROM bounded_signal signal
			CROSS JOIN LATERAL (
				SELECT target_id, count(*) OVER () AS peer_count
				FROM (
					SELECT candidate.target_id
					FROM (
					SELECT candidate.unit_id AS target_id
					FROM unit_tag candidate
					WHERE signal.kind = 'tag' AND candidate.tag_id = signal.signal_id
					UNION ALL
					SELECT candidate.source_unit_id
					FROM credit_attribution candidate
					WHERE signal.kind = 'credit'
						AND candidate.credited_unit_id = signal.signal_id
					UNION ALL
					SELECT candidate.unit_id
					FROM subject_association candidate
					WHERE signal.kind = 'subject' AND candidate.entity_id = signal.signal_id
					UNION ALL
					SELECT candidate.release_unit_id
					FROM series_release candidate
					WHERE signal.kind = 'series' AND candidate.series_id = signal.signal_id
					UNION ALL
					SELECT signal.signal_id
					WHERE signal.kind = 'post-subject'
					) candidate
					WHERE candidate.target_id <> signal.source_id
					ORDER BY candidate.target_id
					LIMIT ${RecommendationPolicy.maxStructuralDegree + 1}
				) capped_candidate
			) peer
		), aggregated AS (
			SELECT source_id, target_id,
				sum(weight / ln(2 + peer_count))::double precision AS score
			FROM bounded_peer
			WHERE peer_count <= ${RecommendationPolicy.maxStructuralDegree}
			GROUP BY source_id, target_id
		), resolved AS (
			SELECT aggregated.source_id,
				coalesce(target_variant.main_unit_id, aggregated.target_id) AS target_id,
				sum(aggregated.score)::double precision AS score
			FROM aggregated
			LEFT JOIN unit_variant target_variant
				ON target_variant.variant_unit_id = aggregated.target_id
			LEFT JOIN unit_variant source_variant
				ON source_variant.variant_unit_id = aggregated.source_id
			WHERE coalesce(target_variant.main_unit_id, aggregated.target_id)
				<> coalesce(source_variant.main_unit_id, aggregated.source_id)
			GROUP BY aggregated.source_id,
				coalesce(target_variant.main_unit_id, aggregated.target_id)
		), ranked AS (
			SELECT resolved.*,
				row_number() OVER (PARTITION BY source_id ORDER BY score DESC, target_id) AS rank
			FROM resolved
		)
		INSERT INTO recommendation_unit_edge (
			snapshot_id, source_unit_id, target_unit_id,
			structural_score, behavioral_score, score, rank
		)
		SELECT ${snapshotId}::uuid, ranked.source_id, ranked.target_id,
			ranked.score, 0, ranked.score, ranked.rank::int
		FROM ranked
		JOIN unit source_unit ON source_unit.id = ranked.source_id
		JOIN unit target_unit ON target_unit.id = ranked.target_id
		WHERE ranked.rank <= ${RecommendationPolicy.maxEdgesPerUnit}
			AND source_unit.status = 'published' AND source_unit.visibility = 'public'
			AND source_unit.moderation_status = 'approved' AND source_unit.deleted_at IS NULL
			AND target_unit.status = 'published' AND target_unit.visibility = 'public'
			AND target_unit.moderation_status = 'approved' AND target_unit.deleted_at IS NULL
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
			const [snapshot] = await session
				.insert(recommendationSnapshot)
				.values({
					policyVersion: RecommendationPolicyVersion,
					sourceWatermark: new Date(),
				})
				.returning({ id: recommendationSnapshot.id });
			if (!snapshot) throw new Error("Recommendation snapshot insertion returned no row");
			snapshotId = snapshot.id;
			await session.transaction((tx) => buildUnitStats(tx, snapshot.id));
			await session.transaction((tx) => buildProfileInterests(tx, snapshot.id));

			let afterId: string | undefined;
			for (;;) {
				const sourceRows = await session
					.select({ id: unit.id })
					.from(unit)
					.where(
						and(
							eq(unit.status, "published"),
							eq(unit.visibility, "public"),
							eq(unit.moderationStatus, "approved"),
							sql`${unit.deletedAt} is null`,
							afterId ? gt(unit.id, afterId) : undefined,
						),
					)
					.orderBy(unit.id)
					.limit(WorkPolicy.recommendation.maxRefreshBatchUnits);
				if (!sourceRows.length) break;
				await session.transaction((tx) =>
					buildUnitEdges(
						tx,
						snapshot.id,
						sourceRows.map(({ id }) => id),
					),
				);
				afterId = sourceRows.at(-1)?.id;
				if (sourceRows.length < WorkPolicy.recommendation.maxRefreshBatchUnits) break;
			}

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
						error:
							error instanceof Error
								? error.message.slice(0, 2_000)
								: "Unknown refresh error",
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
			INSERT INTO recommendation_metric_daily (
				day, surface, policy_version, impressions, opens, dwell_30s, not_interested
		)
		SELECT occurred_at::date, surface, policy_version,
			count(*) FILTER (WHERE type = 'impression'),
			count(*) FILTER (WHERE type = 'open'),
			count(*) FILTER (WHERE type = 'dwell_30s'),
			count(*) FILTER (WHERE type = 'not_interested')
		FROM recommendation_event
		WHERE surface IS NOT NULL AND policy_version IS NOT NULL
			AND occurred_at >= current_date - interval '2 days'
		GROUP BY occurred_at::date, surface, policy_version
		ON CONFLICT (day, surface, policy_version) DO UPDATE SET
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
		now.getTime() - RecommendationPolicy.interestMaxAgeDays * 86_400_000,
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
	await database.execute(
		sql`delete from recommendation_profile_signal_hourly where bucket_start < ${signalBoundary}`,
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
