import type { FeedSortValues } from "../database/schema/contract-values";
import { WorkPolicy } from "../performance/policy";

export const RecommendationPolicyVersion = "sparse_best_v2";

export type RecommendationSort = (typeof FeedSortValues)[number];

export const RecommendationPolicy = {
	maxCandidates: WorkPolicy.recommendation.maxOnlineCandidates,
	maxRelationCandidates: WorkPolicy.recommendation.maxRelationCandidates,
	bestWindowDays: 7,
	bestHalfLifeHours: 24,
	signalRetentionDays: 7,
	snapshotRetentionHours: 72,
	snapshotStaleHours: 3,
	eventRetentionDays: 90,
} as const;
