import type { FeedSortValues } from "../database/schema/contract-values";
import { WorkPolicy } from "../performance/policy";

export const RecommendationPolicyVersion = "native_best_v1";

export type RecommendationSort = (typeof FeedSortValues)[number];

export const RecommendationPolicy = {
	maxCandidates: WorkPolicy.recommendation.maxOnlineCandidates,
	maxRelationCandidates: WorkPolicy.recommendation.maxRelationCandidates,
	bestWindowDays: 7,
	bestHalfLifeHours: 24,
	signalRetentionDays: 7,
	snapshotRetentionHours: 4,
	snapshotStaleHours: 3,
	eventRetentionDays: 90,
	eventMaxBatchSize: 100,
	eventTransactionMs: 10_000,
	buildPartitions: 64,
	buildBatchSize: 4096,
	buildConcurrency: 4,
	buildLeaseMs: 30_000,
	buildTransactionMs: 20_000,
	buildDeadlineMs: 2 * 3_600_000,
	buildMaximumFailures: 12,
} as const;
