import type { FeedSortValues } from "../database/schema/contract-values";

export const RecommendationPolicyVersion = "hybrid_v1";

export type RecommendationSort = (typeof FeedSortValues)[number];

export interface SortWeights {
	readonly personalized: number;
	readonly objective: number;
	readonly freshness: number;
}

export const SortWeightByKind = {
	best: { personalized: 0.6, objective: 0.25, freshness: 0.15 },
	hot: { personalized: 0.35, objective: 0.5, freshness: 0.15 },
	new: { personalized: 0.3, objective: 0.7, freshness: 0 },
	top: { personalized: 0.3, objective: 0.7, freshness: 0 },
	rising: { personalized: 0.35, objective: 0.65, freshness: 0 },
} as const satisfies Record<RecommendationSort, SortWeights>;

export const RecommendationPolicy = {
	maxCandidates: 280,
	maxGraphCandidates: 120,
	maxFollowCandidates: 60,
	maxObjectiveCandidates: 80,
	maxExplorationCandidates: 20,
	maxEdgesPerUnit: 100,
	maxInterestsPerProfile: 50,
	maxInteractionsPerProfile: 100,
	maxStructuralDegree: 500,
	mmrLambda: 0.8,
	pageDiversityCap: 3,
	explorationRatio: 0.1,
	interestHalfLifeDays: 30,
	interestMaxAgeDays: 180,
	snapshotRetentionHours: 24,
	snapshotStaleHours: 2,
	eventRetentionDays: 90,
} as const;
