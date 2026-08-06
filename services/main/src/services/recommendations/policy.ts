import type { FeedSortValues } from "../database/schema/contract-values";
import { WorkPolicy } from "../performance/policy";

export const RecommendationPolicyVersion = "bounded_structural_v1";

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
	maxCandidates: WorkPolicy.recommendation.maxOnlineCandidates,
	maxGraphCandidates: WorkPolicy.recommendation.maxEdgesPerUnit,
	maxFollowCandidates: WorkPolicy.recommendation.maxFollowCandidates,
	maxObjectiveCandidates: WorkPolicy.recommendation.maxObjectiveCandidates,
	maxExplorationCandidates: 20,
	maxEdgesPerUnit: WorkPolicy.recommendation.maxEdgesPerUnit,
	maxInterestsPerProfile: WorkPolicy.recommendation.maxInterestsPerProfile,
	maxInteractionsPerProfile: WorkPolicy.recommendation.maxRecentInteractionsPerProfile,
	maxStructuralSignals: WorkPolicy.recommendation.maxStructuralSignals,
	maxStructuralDegree: WorkPolicy.recommendation.maxStructuralDegree,
	maxRawStructuralPeers: WorkPolicy.recommendation.maxRawStructuralPeers,
	maxBehavioralPeersPerUnit: WorkPolicy.recommendation.maxBehavioralPeersPerUnit,
	mmrLambda: 0.8,
	pageDiversityCap: 3,
	explorationRatio: 0.1,
	interestHalfLifeDays: 30,
	interestMaxAgeDays: 180,
	snapshotRetentionHours: 72,
	snapshotStaleHours: 36,
	eventRetentionDays: 90,
} as const;
