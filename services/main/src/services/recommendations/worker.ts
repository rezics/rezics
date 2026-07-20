import { and, desc, eq, lt, ne, sql } from "drizzle-orm";

import { database, type DatabaseTransaction } from "../database";
import { recommendationSnapshot } from "../database/schema";
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

async function buildUnitEdges(tx: DatabaseTransaction, snapshotId: string) {
	await tx.execute(sql`
		CREATE TEMP TABLE recommendation_base_edge ON COMMIT DROP AS
		WITH tag_degree AS (
			SELECT tag_id, count(*)::double precision AS degree FROM unit_tag GROUP BY tag_id
		), tag_pair AS (
			SELECT a.unit_id AS left_id, b.unit_id AS right_id,
				sum(1 / ln(1 + d.degree)) AS score
			FROM unit_tag a
			JOIN unit_tag b ON b.tag_id = a.tag_id AND a.unit_id < b.unit_id
			JOIN tag_degree d
				ON d.tag_id = a.tag_id AND d.degree <= ${RecommendationPolicy.maxStructuralDegree}
			GROUP BY a.unit_id, b.unit_id
		), credit_degree AS (
			SELECT entity_id, count(*)::double precision AS degree
			FROM credit_attribution
			GROUP BY entity_id
		), credit_pair AS (
			SELECT a.unit_id AS left_id, b.unit_id AS right_id,
				sum(1 / ln(1 + d.degree)) AS score
			FROM credit_attribution a
			JOIN credit_attribution b ON b.entity_id = a.entity_id AND a.unit_id < b.unit_id
			JOIN credit_degree d
				ON d.entity_id = a.entity_id AND d.degree <= ${RecommendationPolicy.maxStructuralDegree}
			GROUP BY a.unit_id, b.unit_id
		), subject_degree AS (
			SELECT entity_id, count(*)::double precision AS degree
			FROM subject_association
			GROUP BY entity_id
		), subject_pair AS (
			SELECT a.unit_id AS left_id, b.unit_id AS right_id,
				sum(1 / ln(1 + d.degree)) AS score
			FROM subject_association a
			JOIN subject_association b ON b.entity_id = a.entity_id AND a.unit_id < b.unit_id
			JOIN subject_degree d
				ON d.entity_id = a.entity_id AND d.degree <= ${RecommendationPolicy.maxStructuralDegree}
			GROUP BY a.unit_id, b.unit_id
		), structural_direct AS (
			SELECT left_id, right_id, score FROM tag_pair
			UNION ALL SELECT left_id, right_id, score FROM credit_pair
			UNION ALL SELECT left_id, right_id, score FROM subject_pair
			UNION ALL
			SELECT a.release_unit_id, b.release_unit_id, 2::double precision
			FROM series_release a
			JOIN series_release b ON b.series_id = a.series_id AND a.release_unit_id < b.release_unit_id
			JOIN (
				SELECT series_id, count(*) AS degree FROM series_release GROUP BY series_id
			) series_degree
				ON series_degree.series_id = a.series_id
				AND series_degree.degree <= ${RecommendationPolicy.maxStructuralDegree}
			UNION ALL
			SELECT least(id, subject_unit_id), greatest(id, subject_unit_id), 2::double precision
			FROM post WHERE subject_unit_id IS NOT NULL
		), structural_pair AS (
			SELECT left_id, right_id, sum(score) AS score
			FROM structural_direct WHERE left_id <> right_id GROUP BY left_id, right_id
		), structural AS (
			SELECT left_id AS source_id, right_id AS target_id, score FROM structural_pair
			UNION ALL SELECT right_id, left_id, score FROM structural_pair
		), interaction_source AS (
			SELECT profile_id, unit_id, weight, bucket_start AS occurred_at
			FROM recommendation_profile_signal_hourly
			WHERE kind IN (
				'upvote', 'favorite', 'share', 'score_high', 'score_medium',
				'progress_active', 'progress_completed', 'open', 'dwell_30s'
			) AND weight > 0
		), interaction AS (
			SELECT interaction_source.profile_id, interaction_source.unit_id,
				least(sum(interaction_source.weight), 10) AS weight,
				max(interaction_source.occurred_at) AS occurred_at
			FROM interaction_source
			JOIN profile_preference preference
				ON preference.profile_id = interaction_source.profile_id
				AND preference.personalized_feed
			WHERE interaction_source.occurred_at >= now() - ${RecommendationPolicy.interestMaxAgeDays} * interval '1 day'
			GROUP BY interaction_source.profile_id, interaction_source.unit_id
		), limited_interaction AS (
			SELECT profile_id, unit_id, weight
			FROM (
				SELECT interaction.*,
					row_number() OVER (PARTITION BY profile_id ORDER BY occurred_at DESC, unit_id) AS rank
				FROM interaction
			) ranked WHERE rank <= ${RecommendationPolicy.maxInteractionsPerProfile}
		), user_degree AS (
			SELECT profile_id, count(*)::double precision AS degree
			FROM limited_interaction GROUP BY profile_id
		), behavioral_pair AS (
			SELECT a.unit_id AS left_id, b.unit_id AS right_id,
				sum(a.weight * b.weight / ln(2 + d.degree)) AS score
			FROM limited_interaction a
			JOIN limited_interaction b ON b.profile_id = a.profile_id AND a.unit_id < b.unit_id
			JOIN user_degree d ON d.profile_id = a.profile_id
			GROUP BY a.unit_id, b.unit_id
		), behavioral AS (
			SELECT left_id AS source_id, right_id AS target_id, score FROM behavioral_pair
			UNION ALL SELECT right_id, left_id, score FROM behavioral_pair
		), combined_raw AS (
			SELECT coalesce(s.source_id, b.source_id) AS source_id,
				coalesce(s.target_id, b.target_id) AS target_id,
				coalesce(s.score, 0) AS structural,
				coalesce(b.score, 0) AS behavioral
			FROM structural s FULL JOIN behavioral b
				ON b.source_id = s.source_id AND b.target_id = s.target_id
		), resolved_combined AS (
			SELECT combined_raw.source_id,
				coalesce(target_relationship.main_unit_id, combined_raw.target_id) AS target_id,
				sum(combined_raw.structural) AS structural,
				sum(combined_raw.behavioral) AS behavioral
			FROM combined_raw
			LEFT JOIN unit_variant target_relationship
				ON target_relationship.variant_unit_id = combined_raw.target_id
			LEFT JOIN unit_variant source_relationship
				ON source_relationship.variant_unit_id = combined_raw.source_id
			WHERE coalesce(target_relationship.main_unit_id, combined_raw.target_id)
				<> coalesce(source_relationship.main_unit_id, combined_raw.source_id)
			GROUP BY combined_raw.source_id,
				coalesce(target_relationship.main_unit_id, combined_raw.target_id)
		), normalized AS (
			SELECT source_id, target_id,
				CASE WHEN max(structural) OVER (PARTITION BY source_id) > 0
					THEN structural / max(structural) OVER (PARTITION BY source_id) ELSE 0 END AS structural,
				CASE WHEN max(behavioral) OVER (PARTITION BY source_id) > 0
					THEN behavioral / max(behavioral) OVER (PARTITION BY source_id) ELSE 0 END AS behavioral
			FROM resolved_combined
			JOIN unit eligible_source ON eligible_source.id = resolved_combined.source_id
			JOIN unit eligible_target ON eligible_target.id = resolved_combined.target_id
			WHERE eligible_source.status = 'published'
				AND eligible_source.visibility = 'public'
				AND eligible_source.moderation_status = 'approved'
				AND eligible_source.deleted_at IS NULL
				AND eligible_target.status = 'published'
				AND eligible_target.visibility = 'public'
				AND eligible_target.moderation_status = 'approved'
				AND eligible_target.deleted_at IS NULL
		)
		SELECT source_id, target_id, structural, behavioral,
			CASE
				WHEN structural > 0 AND behavioral > 0 THEN structural * 0.45 + behavioral * 0.55
				WHEN behavioral > 0 THEN behavioral
				ELSE structural
			END AS score
		FROM normalized
		WHERE structural > 0 OR behavioral > 0
	`);

	await tx.execute(sql`
		WITH probability AS (
			SELECT *, score / sum(score) OVER (PARTITION BY source_id) AS probability
			FROM recommendation_base_edge WHERE score > 0
		), walk AS (
			SELECT source_id, target_id, probability * 0.8 AS contribution FROM probability
			UNION ALL
			SELECT first.source_id, second.target_id,
				first.probability * second.probability * 0.64 AS contribution
			FROM probability first
			JOIN probability second ON second.source_id = first.target_id
			WHERE first.source_id <> second.target_id
		), aggregated AS (
			SELECT source_id, target_id, sum(contribution) AS score
			FROM walk WHERE source_id <> target_id GROUP BY source_id, target_id
		), ranked AS (
			SELECT aggregated.*,
				row_number() OVER (PARTITION BY source_id ORDER BY score DESC, target_id) AS rank
			FROM aggregated WHERE score > 0
		)
		INSERT INTO recommendation_unit_edge (
			snapshot_id, source_unit_id, target_unit_id,
			structural_score, behavioral_score, score, rank
		)
		SELECT ${snapshotId}::uuid, ranked.source_id, ranked.target_id,
			coalesce(base.structural, 0), coalesce(base.behavioral, 0), ranked.score, ranked.rank::int
		FROM ranked
		LEFT JOIN recommendation_base_edge base
			ON base.source_id = ranked.source_id AND base.target_id = ranked.target_id
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
	try {
		return await database.transaction(
			async (tx) => {
				const lock = await tx.execute<{ acquired: boolean }>(
					sql`select pg_try_advisory_xact_lock(hashtextextended('recommendation-refresh', 0)) AS acquired`,
				);
				if (!lock.rows[0]?.acquired) return null;
				const [snapshot] = await tx
					.insert(recommendationSnapshot)
					.values({
						policyVersion: RecommendationPolicyVersion,
						sourceWatermark: new Date(),
					})
					.returning({ id: recommendationSnapshot.id });
				if (!snapshot) throw new Error("Recommendation snapshot insertion returned no row");
				await buildUnitStats(tx, snapshot.id);
				await buildProfileInterests(tx, snapshot.id);
				await buildUnitEdges(tx, snapshot.id);
				const completedAt = new Date();
				await tx
					.update(recommendationSnapshot)
					.set({ active: false })
					.where(eq(recommendationSnapshot.active, true));
				await tx
					.update(recommendationSnapshot)
					.set({ state: "ready", active: true, completedAt, error: null })
					.where(eq(recommendationSnapshot.id, snapshot.id));
				await tx.execute(sql`
					SELECT touch_search_unit_projection(array_agg(distinct unit_id))
					FROM recommendation_unit_stat
					WHERE snapshot_id = ${snapshot.id}::uuid
				`);
				return snapshot.id;
			},
			{ isolationLevel: "repeatable read" },
		);
	} catch (error) {
		const completedAt = new Date();
		await database.insert(recommendationSnapshot).values({
			policyVersion: RecommendationPolicyVersion,
			state: "failed",
			active: false,
			completedAt,
			error: error instanceof Error ? error.message.slice(0, 2_000) : "Unknown refresh error",
		});
		throw error;
	}
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
