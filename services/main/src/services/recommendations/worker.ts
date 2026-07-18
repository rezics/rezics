import { and, desc, eq, lt, ne, sql } from "drizzle-orm";

import { database, type DatabaseTransaction } from "../database";
import { recommendationSnapshot } from "../database/schema";
import { RecommendationPolicy, RecommendationPolicyVersion } from "./policy";

async function buildUnitStats(tx: DatabaseTransaction, snapshotId: string) {
	await tx.execute(sql`
		WITH event_stats AS (
			SELECT target_unit_id AS unit_id,
				count(*) FILTER (WHERE type = 'impression')::int AS impressions,
				count(*) FILTER (WHERE type = 'open')::int AS opens,
				count(*) FILTER (WHERE type = 'dwell_30s')::int AS dwell30s
				FROM recommendation_event
				WHERE occurred_at >= now() - ${RecommendationPolicy.eventRetentionDays} * interval '1 day'
					AND profile_id IS NOT NULL
			GROUP BY target_unit_id
		), reaction_stats AS (
			SELECT unit_id,
				count(*) FILTER (WHERE reaction = 'upvote')::int AS upvotes,
				count(*) FILTER (WHERE reaction = 'downvote')::int AS downvotes
			FROM unit_reaction
			GROUP BY unit_id
		), reply_targets AS (
			SELECT root_post_id AS unit_id, post_id AS reply_id FROM post_reply
			UNION ALL
			SELECT parent_post_id AS unit_id, post_id AS reply_id
			FROM post_reply WHERE parent_post_id IS NOT NULL
		), reply_stats AS (
			SELECT reply_targets.unit_id, count(*)::int AS replies
			FROM reply_targets
			JOIN unit reply_unit ON reply_unit.id = reply_targets.reply_id
			WHERE reply_unit.deleted_at IS NULL
			GROUP BY reply_targets.unit_id
		), favorite_stats AS (
			SELECT ci.unit_id, count(*)::int AS favorites
			FROM collection_item ci
			JOIN collection c ON c.id = ci.collection_id AND c.kind = 'favorites'
			GROUP BY ci.unit_id
		), share_stats AS (
			SELECT unit_id, count(*)::int AS shares
			FROM unit_share
			GROUP BY unit_id
		), score_stats AS (
			SELECT unit_id, count(*) FILTER (WHERE value >= 8)::int AS high_scores
			FROM score
			GROUP BY unit_id
		), progress_stats AS (
			SELECT unit_id,
				count(*) FILTER (WHERE status = 'active')::int AS active_progress,
				count(*) FILTER (WHERE status = 'completed')::int AS completions,
				count(*) FILTER (WHERE status = 'dropped')::int AS negative_progress
			FROM unit_progress
			WHERE deleted_at IS NULL
			GROUP BY unit_id
		), window_signal AS (
			SELECT target_unit_id AS unit_id, occurred_at,
				CASE type WHEN 'open' THEN 1 WHEN 'dwell_30s' THEN 2 ELSE 0 END::double precision AS weight
				FROM recommendation_event
				WHERE profile_id IS NOT NULL AND type IN ('open', 'dwell_30s')
			UNION ALL
			SELECT unit_id, updated_at,
				CASE reaction WHEN 'upvote' THEN 3 ELSE 0 END::double precision
			FROM unit_reaction
			UNION ALL
			SELECT root_post_id, created_at, 4::double precision FROM post_reply
			UNION ALL
			SELECT parent_post_id, created_at, 4::double precision
			FROM post_reply WHERE parent_post_id IS NOT NULL
			UNION ALL
			SELECT ci.unit_id, ci.created_at, 5::double precision
			FROM collection_item ci
			JOIN collection c ON c.id = ci.collection_id AND c.kind = 'favorites'
			UNION ALL
			SELECT unit_id, created_at, 4::double precision FROM unit_share
			UNION ALL
			SELECT unit_id, updated_at,
				CASE WHEN value >= 8 THEN 5 WHEN value >= 6 THEN 3 ELSE 0 END::double precision
			FROM score
			UNION ALL
			SELECT unit_id, last_seen_at,
				CASE status WHEN 'completed' THEN 5 WHEN 'active' THEN 3 ELSE 0 END::double precision
			FROM unit_progress WHERE deleted_at IS NULL
		), window_stats AS (
			SELECT unit_id,
				coalesce(sum(weight) FILTER (WHERE occurred_at >= now() - interval '6 hours'), 0) AS engagement6h,
				coalesce(sum(weight) FILTER (WHERE occurred_at >= now() - interval '24 hours'), 0) AS engagement24h,
				coalesce(sum(weight) FILTER (WHERE occurred_at >= now() - interval '7 days'), 0) AS engagement7d
			FROM window_signal
			WHERE occurred_at >= now() - interval '7 days' AND weight > 0
			GROUP BY unit_id
		)
		INSERT INTO recommendation_unit_stat (
				snapshot_id, unit_id, context_realm_id, impressions, opens, dwell_30s,
			upvotes, downvotes, replies, favorites, shares, high_scores,
			active_progress, completions, negative_progress,
				engagement_6h, engagement_24h, engagement_7d
		)
		SELECT ${snapshotId}::uuid, u.id, NULL,
			coalesce(es.impressions, 0), coalesce(es.opens, 0), coalesce(es.dwell30s, 0),
			coalesce(rs.upvotes, 0), coalesce(rs.downvotes, 0), coalesce(replies.replies, 0),
			coalesce(fs.favorites, 0), coalesce(shares.shares, 0), coalesce(scores.high_scores, 0),
			coalesce(progress.active_progress, 0), coalesce(progress.completions, 0),
			coalesce(progress.negative_progress, 0), coalesce(ws.engagement6h, 0),
			coalesce(ws.engagement24h, 0), coalesce(ws.engagement7d, 0)
		FROM unit u
		LEFT JOIN event_stats es ON es.unit_id = u.id
		LEFT JOIN reaction_stats rs ON rs.unit_id = u.id
		LEFT JOIN reply_stats replies ON replies.unit_id = u.id
		LEFT JOIN favorite_stats fs ON fs.unit_id = u.id
		LEFT JOIN share_stats shares ON shares.unit_id = u.id
		LEFT JOIN score_stats scores ON scores.unit_id = u.id
		LEFT JOIN progress_stats progress ON progress.unit_id = u.id
		LEFT JOIN window_stats ws ON ws.unit_id = u.id
		WHERE u.status = 'published' AND u.visibility = 'public'
			AND u.moderation_status = 'approved' AND u.deleted_at IS NULL
	`);
}

async function buildProfileInterests(tx: DatabaseTransaction, snapshotId: string) {
	await tx.execute(sql`
		WITH signal AS (
			SELECT profile_id, unit_id,
				CASE reaction WHEN 'upvote' THEN 3 ELSE -4 END::double precision AS weight,
				updated_at AS occurred_at
			FROM unit_reaction
			UNION ALL
			SELECT ci.added_by_profile_id, ci.unit_id, 5::double precision, ci.created_at
			FROM collection_item ci
			JOIN collection c ON c.id = ci.collection_id AND c.kind = 'favorites'
			WHERE ci.added_by_profile_id IS NOT NULL
			UNION ALL
			SELECT profile_id, unit_id, 4::double precision, created_at FROM unit_share
			UNION ALL
			SELECT profile_id, unit_id,
				CASE WHEN value >= 8 THEN 5 WHEN value >= 6 THEN 3 WHEN value <= 3 THEN -4 ELSE 0 END::double precision,
				updated_at
			FROM score
			UNION ALL
			SELECT profile_id, unit_id,
				CASE status WHEN 'completed' THEN 5 WHEN 'active' THEN 3 WHEN 'dropped' THEN -4 ELSE 0 END::double precision,
				last_seen_at
			FROM unit_progress WHERE deleted_at IS NULL
			UNION ALL
			SELECT profile_id, target_unit_id,
				CASE type WHEN 'open' THEN 1 WHEN 'dwell_30s' THEN 2 WHEN 'not_interested' THEN -4 ELSE 0 END::double precision,
				occurred_at
			FROM recommendation_event
			WHERE profile_id IS NOT NULL AND type IN ('open', 'dwell_30s', 'not_interested')
		), decayed AS (
			SELECT profile_id, unit_id,
				sum(weight * exp(-ln(2) * extract(epoch FROM (now() - occurred_at)) / (${RecommendationPolicy.interestHalfLifeDays} * 86400))) AS weight
			FROM signal
			WHERE profile_id IS NOT NULL AND weight <> 0
				AND occurred_at >= now() - ${RecommendationPolicy.interestMaxAgeDays} * interval '1 day'
			GROUP BY profile_id, unit_id
		), ranked AS (
			SELECT d.profile_id, d.unit_id, d.weight,
				row_number() OVER (PARTITION BY d.profile_id ORDER BY d.weight DESC, d.unit_id) AS rank
			FROM decayed d
			JOIN profile_preference preference ON preference.profile_id = d.profile_id
			LEFT JOIN recommendation_exclusion exclusion
				ON exclusion.profile_id = d.profile_id AND exclusion.unit_id = d.unit_id
			WHERE preference.personalized_feed AND d.weight > 0 AND exclusion.unit_id IS NULL
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
		), structural_direct AS (
			SELECT left_id, right_id, score FROM tag_pair
			UNION ALL SELECT left_id, right_id, score FROM credit_pair
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
			SELECT least(unit_id, canonical_unit_id), greatest(unit_id, canonical_unit_id), 3::double precision
			FROM unit_variant
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
			SELECT profile_id, unit_id, 3::double precision AS weight, updated_at AS occurred_at
			FROM unit_reaction WHERE reaction = 'upvote'
			UNION ALL
			SELECT ci.added_by_profile_id, ci.unit_id, 5::double precision, ci.created_at
			FROM collection_item ci JOIN collection c ON c.id = ci.collection_id AND c.kind = 'favorites'
			WHERE ci.added_by_profile_id IS NOT NULL
			UNION ALL SELECT profile_id, unit_id, 4::double precision, created_at FROM unit_share
			UNION ALL SELECT profile_id, unit_id,
				CASE WHEN value >= 8 THEN 5 ELSE 3 END::double precision, updated_at
			FROM score WHERE value >= 6
			UNION ALL SELECT profile_id, unit_id,
				CASE status WHEN 'completed' THEN 5 ELSE 3 END::double precision, last_seen_at
			FROM unit_progress WHERE deleted_at IS NULL AND status IN ('active', 'completed')
			UNION ALL SELECT profile_id, target_unit_id,
				CASE type WHEN 'dwell_30s' THEN 2 ELSE 1 END::double precision, occurred_at
			FROM recommendation_event
			WHERE profile_id IS NOT NULL AND type IN ('open', 'dwell_30s')
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
		), combined AS (
			SELECT coalesce(s.source_id, b.source_id) AS source_id,
				coalesce(s.target_id, b.target_id) AS target_id,
				coalesce(s.score, 0) AS structural,
				coalesce(b.score, 0) AS behavioral
			FROM structural s FULL JOIN behavioral b
				ON b.source_id = s.source_id AND b.target_id = s.target_id
		), normalized AS (
			SELECT source_id, target_id,
				CASE WHEN max(structural) OVER (PARTITION BY source_id) > 0
					THEN structural / max(structural) OVER (PARTITION BY source_id) ELSE 0 END AS structural,
				CASE WHEN max(behavioral) OVER (PARTITION BY source_id) > 0
					THEN behavioral / max(behavioral) OVER (PARTITION BY source_id) ELSE 0 END AS behavioral
			FROM combined
			JOIN unit eligible_source ON eligible_source.id = combined.source_id
			JOIN unit eligible_target ON eligible_target.id = combined.target_id
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
			count(*) FILTER (WHERE type = 'impression')::int,
			count(*) FILTER (WHERE type = 'open')::int,
			count(*) FILTER (WHERE type = 'dwell_30s')::int,
			count(*) FILTER (WHERE type = 'not_interested')::int
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
