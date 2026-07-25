import { and, desc, eq, exists, inArray, ne, or, sql } from "drizzle-orm";

import {
	getFeedEligibilityCondition,
	getFeedRankingCandidates,
	hydrateFeedItems,
	type CandidateSources,
} from "../api/feed";
import { database } from "../database";
import {
	post,
	recommendationProfileInterest,
	recommendationUnitEdge,
	unit,
	creditAttribution,
} from "../database/schema";
import type { RecommendationReason } from "../api/recommendations/schema";
import type { FeedQuery } from "../api/feed/schema";
import type { RecommendationSnapshotContext, RecommendationViewer } from "./context";
import { RecommendationPolicy, RecommendationPolicyVersion } from "./policy";
import { rankRecommendations } from "./ranking";

const RelatedPostFeedQuery = {
	content: ["post:post", "post:reply"],
} satisfies Pick<FeedQuery, "content">;

export async function recommendRelatedPosts(input: {
	viewer: RecommendationViewer;
	snapshot: RecommendationSnapshotContext | null;
	seed: { id: string; subjectId: string | null; creditedUnitIds: readonly string[] };
	asOf: Date;
	pageSize: number;
	afterId?: string;
	requestId: string;
}) {
	const snapshotId = input.snapshot?.id;
	const seedIds = [input.seed.id, ...(input.seed.subjectId ? [input.seed.subjectId] : [])];
	const eligible = getFeedEligibilityCondition(
		input.viewer,
		RelatedPostFeedQuery,
		input.asOf,
		input.afterId,
	);
	const graphScore = sql<number>`sum(${recommendationUnitEdge.score})`;
	const graphPromise = snapshotId
		? database
				.select({ id: recommendationUnitEdge.targetUnitId, score: graphScore })
				.from(recommendationUnitEdge)
				.innerJoin(post, eq(post.id, recommendationUnitEdge.targetUnitId))
				.innerJoin(unit, eq(unit.id, post.id))
				.where(
					and(
						eq(recommendationUnitEdge.snapshotId, snapshotId),
						inArray(recommendationUnitEdge.sourceUnitId, seedIds),
						ne(recommendationUnitEdge.targetUnitId, input.seed.id),
						eligible,
					),
				)
				.groupBy(recommendationUnitEdge.targetUnitId)
				.orderBy(desc(graphScore), desc(recommendationUnitEdge.targetUnitId))
				.limit(RecommendationPolicy.maxGraphCandidates)
		: Promise.resolve([]);
	const profileScore = sql<number>`sum(${recommendationProfileInterest.weight} * ${recommendationUnitEdge.score})`;
	const profilePromise =
		snapshotId && input.viewer.personalized && input.viewer.profileId
			? database
					.select({ id: recommendationUnitEdge.targetUnitId, score: profileScore })
					.from(recommendationProfileInterest)
					.innerJoin(
						recommendationUnitEdge,
						and(
							eq(
								recommendationUnitEdge.snapshotId,
								recommendationProfileInterest.snapshotId,
							),
							eq(
								recommendationUnitEdge.sourceUnitId,
								recommendationProfileInterest.unitId,
							),
						),
					)
					.innerJoin(post, eq(post.id, recommendationUnitEdge.targetUnitId))
					.innerJoin(unit, eq(unit.id, post.id))
					.where(
						and(
							eq(recommendationProfileInterest.snapshotId, snapshotId),
							eq(recommendationProfileInterest.profileId, input.viewer.profileId),
							ne(recommendationUnitEdge.targetUnitId, input.seed.id),
							eligible,
						),
					)
					.groupBy(recommendationUnitEdge.targetUnitId)
					.orderBy(desc(profileScore), desc(recommendationUnitEdge.targetUnitId))
					.limit(RecommendationPolicy.maxGraphCandidates)
			: Promise.resolve([]);
	const contextualPromise = database
		.select({ id: post.id })
		.from(post)
		.innerJoin(unit, eq(unit.id, post.id))
		.where(
			and(
				ne(post.id, input.seed.id),
				eligible,
				or(
					input.seed.subjectId ? eq(post.subjectUnitId, input.seed.subjectId) : undefined,
					input.seed.creditedUnitIds.length
						? exists(
								database
									.select({ id: creditAttribution.id })
									.from(creditAttribution)
									.where(
										and(
											eq(creditAttribution.sourceUnitId, post.id),
											inArray(creditAttribution.creditedUnitId, [
												...input.seed.creditedUnitIds,
											]),
										),
									),
							)
						: undefined,
				),
			),
		)
		.orderBy(desc(unit.createdAt), desc(unit.id))
		.limit(RecommendationPolicy.maxObjectiveCandidates);
	const recentPromise = database
		.select({ id: post.id })
		.from(post)
		.innerJoin(unit, eq(unit.id, post.id))
		.where(and(ne(post.id, input.seed.id), eligible))
		.orderBy(desc(unit.createdAt), desc(unit.id))
		.limit(RecommendationPolicy.maxExplorationCandidates);
	const [graphRows, profileRows, contextualRows, recentRows] = await Promise.all([
		graphPromise,
		profilePromise,
		contextualPromise,
		recentPromise,
	]);
	const relevance = new Map<string, number>();
	const reason = new Map<string, RecommendationReason>();
	for (const row of graphRows) {
		relevance.set(row.id, (relevance.get(row.id) ?? 0) + Number(row.score) * 2);
		reason.set(row.id, "related_subject");
	}
	for (const row of contextualRows) {
		relevance.set(row.id, (relevance.get(row.id) ?? 0) + 0.5);
		if (!reason.has(row.id)) reason.set(row.id, "related_subject");
	}
	for (const row of profileRows) {
		relevance.set(row.id, (relevance.get(row.id) ?? 0) + Number(row.score));
		if (!reason.has(row.id)) reason.set(row.id, "based_on_activity");
	}
	for (const row of recentRows) if (!reason.has(row.id)) reason.set(row.id, "new_and_relevant");
	const sources: CandidateSources = {
		ids: [
			...new Set([
				...graphRows.map(({ id }) => id),
				...contextualRows.map(({ id }) => id),
				...profileRows.map(({ id }) => id),
				...recentRows.map(({ id }) => id),
			]),
		].slice(0, RecommendationPolicy.maxCandidates),
		relevance,
		reason,
	};
	const candidates = await getFeedRankingCandidates({
		ids: sources.ids,
		sources,
		viewer: input.viewer,
		query: RelatedPostFeedQuery,
		snapshotId: snapshotId ?? null,
		asOf: input.asOf,
		...(input.afterId ? { anchorId: input.afterId } : {}),
	});
	const ranked = rankRecommendations(candidates, {
		sort: "best",
		personalized: true,
		asOf: input.asOf,
		pageSize: input.pageSize,
	});
	const start = input.afterId ? ranked.findIndex(({ id }) => id === input.afterId) + 1 : 0;
	if (input.afterId && start === 0) return null;
	const page = ranked.slice(start, start + input.pageSize);
	const items = await hydrateFeedItems(page, input.viewer, RelatedPostFeedQuery, input.asOf, {
		kind: "recommendation",
		reasons: reason,
		surface: "post_related",
		requestId: input.requestId,
		positionOffset: start,
		policyVersion: input.snapshot?.policyVersion ?? RecommendationPolicyVersion,
	});
	return {
		items: items.filter((item) => item.itemType === "post"),
		nextId: start + page.length < ranked.length ? page.at(-1)?.id : undefined,
	};
}
