import { and, desc, eq, inArray, ne } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";

import {
	getFeedEligibilityCondition,
	getFeedRankingCandidates,
	hydrateFeedItems,
	type CandidateSources,
	type FeedEligibilityScope,
} from "../api/feed";
import { contentRatingPolicyFromAllowlist } from "../content-rating/policy";
import type { RecommendationReason } from "../api/recommendations/schema";
import { database } from "../database";
import { creditAttribution, post, unit } from "../database/schema";
import { searchGlobalIdentifiers } from "../search/service";
import type { RecommendationSnapshotContext, RecommendationViewer } from "./context";
import { RecommendationPolicy, RecommendationPolicyVersion } from "./policy";
import { rankRecommendations } from "./ranking";

const RelatedPostFeedQuery = {
	content: ["post:post", "post:reply"],
} as const satisfies FeedEligibilityScope;

export async function recommendRelatedPosts(input: {
	viewer: RecommendationViewer;
	snapshot: RecommendationSnapshotContext | null;
	seed: { id: string; subjectId: string | null; creditedUnitIds: readonly string[] };
	asOf: Date;
	pageSize: number;
	localizationLanguages: readonly ContentLanguage[];
	afterId?: string;
	requestId: string;
}) {
	const feedQuery = {
		...RelatedPostFeedQuery,
		localizationLanguages: input.localizationLanguages,
	};
	const eligible = getFeedEligibilityCondition(
		input.viewer,
		feedQuery,
		input.asOf,
		input.afterId,
	);
	const [subjectRows, creditRows, best] = await Promise.all([
		input.seed.subjectId
			? database
					.select({ id: post.id })
					.from(post)
					.innerJoin(unit, eq(unit.id, post.id))
					.where(
						and(
							eq(post.subjectUnitId, input.seed.subjectId),
							ne(post.id, input.seed.id),
							eligible,
						),
					)
					.orderBy(desc(post.createdAt), desc(post.id))
					.limit(RecommendationPolicy.maxRelationCandidates)
			: [],
		input.seed.creditedUnitIds.length
			? database
					.selectDistinct({ id: creditAttribution.sourceUnitId })
					.from(creditAttribution)
					.innerJoin(post, eq(post.id, creditAttribution.sourceUnitId))
					.innerJoin(unit, eq(unit.id, post.id))
					.where(
						and(
							inArray(creditAttribution.creditedUnitId, [
								...input.seed.creditedUnitIds,
							]),
							ne(post.id, input.seed.id),
							eligible,
						),
					)
					.orderBy(creditAttribution.sourceUnitId)
					.limit(RecommendationPolicy.maxRelationCandidates)
			: [],
		searchGlobalIdentifiers({
			branches: [
				{
					category: "posts",
					searchExpression: {
						field: "kind",
						operator: "any-of",
						values: ["post", "reply"],
					},
					sourceUnitKinds: ["post"],
				},
			],
			contentRatings: [...input.viewer.contentRatings],
			contentRatingPolicy: contentRatingPolicyFromAllowlist(input.viewer.contentRatings),
			...(input.viewer.profileId ? { profileId: input.viewer.profileId } : {}),
			limit: RecommendationPolicy.maxCandidates,
			sort: "best",
		}),
	]);
	const contextualIds = new Set([
		...subjectRows.map(({ id }) => id),
		...creditRows.map(({ id }) => id),
	]);
	const reason = new Map<string, RecommendationReason>(
		[...contextualIds].map((id) => [id, "related_subject"]),
	);
	const sources: CandidateSources = {
		ids: [
			...new Set([
				...contextualIds,
				...best.hits.map(({ id }) => id).filter((id) => id !== input.seed.id),
			]),
		].slice(0, RecommendationPolicy.maxCandidates),
		reason,
	};
	const candidates = await getFeedRankingCandidates({
		ids: sources.ids,
		sources,
		viewer: input.viewer,
		query: feedQuery,
		snapshotId: input.snapshot?.id ?? null,
		asOf: input.asOf,
		...(input.afterId ? { anchorId: input.afterId } : {}),
	});
	const ranked = rankRecommendations(candidates, { sort: "best" }).sort(
		(left, right) => Number(contextualIds.has(right.id)) - Number(contextualIds.has(left.id)),
	);
	const start = input.afterId ? ranked.findIndex(({ id }) => id === input.afterId) + 1 : 0;
	if (input.afterId && start === 0) return null;
	const page = ranked.slice(start, start + input.pageSize);
	const items = await hydrateFeedItems(page, input.viewer, feedQuery, input.asOf, {
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
