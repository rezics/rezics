import { unitStateRelation } from "../units/state-relation";
import type { ContentLanguage } from "@rezics/i18n";
import { sql } from "drizzle-orm";

import {
	getFeedEligibilityCondition,
	getFeedRankingCandidates,
	hydrateFeedItems,
	type CandidateSources,
	type FeedEligibilityScope,
} from "../api/feed";
import type { RecommendationReason } from "../api/recommendations/schema";
import { contentRatingPolicyFromAllowlist } from "../content-rating/policy";
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
	seed: { id: string; subjectId: string | null; creditedEntityIds: readonly string[] };
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
	const eligible = getFeedEligibilityCondition(input.viewer, feedQuery, input.asOf, input.afterId);
	const target = unitStateRelation(sql`null::uuid`, "search_unit");
	const base = {
		branches: [
			{
				category: "posts" as const,
				sourceOwners: ["post" as const],
				sourceShapes: ["post", "reply"],
			},
		],
		contentRatings: [...input.viewer.contentRatings],
		contentRatingPolicy: contentRatingPolicyFromAllowlist(input.viewer.contentRatings),
		...(input.viewer.profileId ? { profileId: input.viewer.profileId } : {}),
		additionalConditions: [eligible, sql`${target.id} <> ${input.seed.id}::uuid`],
		bestSnapshotId: input.snapshot?.id ?? null,
	};
	const [subjectRows, creditRows, best] = await Promise.all([
		input.seed.subjectId
			? searchGlobalIdentifiers({
					...base,
					subjectId: input.seed.subjectId,
					limit: RecommendationPolicy.maxRelationCandidates,
					sort: "createdAt:desc",
				})
			: { hits: [] },
		input.seed.creditedEntityIds.length
			? searchGlobalIdentifiers({
					...base,
					branches: [
						{
							...base.branches[0]!,
							searchExpression: {
								field: "credit",
								operator: "any-of",
								values: [...input.seed.creditedEntityIds],
							},
						},
					],
					limit: RecommendationPolicy.maxRelationCandidates,
					sort: "createdAt:desc",
				})
			: { hits: [] },
		searchGlobalIdentifiers({ ...base, limit: RecommendationPolicy.maxCandidates, sort: "best" }),
	]);

	const contextualIds = new Set([
		...subjectRows.hits.map(({ id }) => id),
		...creditRows.hits.map(({ id }) => id),
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
