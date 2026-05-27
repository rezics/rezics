import type { RankingScores, RankingSignalSnapshot } from "./types";

export const RANKING_FORMULA_VERSION = "ranking-v1";

function ageHours(value?: string | null) {
  if (!value) return 24 * 365;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 24 * 365;
  return Math.max((Date.now() - time) / 3_600_000, 0);
}

function reactionWeight(counts: Record<string, number> = {}) {
  return (counts.like ?? 0) + (counts.love ?? 0) * 1.5 - (counts.dislike ?? 0);
}

function safeNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function computeV1RankingScores(
  snapshot: RankingSignalSnapshot,
): RankingScores {
  const reactions = reactionWeight(snapshot.reactionCounts);
  const scoreTotal = safeNumber(snapshot.scoreTotal);
  const scoreCount = safeNumber(snapshot.scoreCount);
  const progressCount = safeNumber(snapshot.progressCount);
  const replies = safeNumber(snapshot.replyCount);
  const directReplies = safeNumber(snapshot.directReplyCount);
  const views = safeNumber(snapshot.bucketSignals?.views);
  const reads = safeNumber(snapshot.bucketSignals?.reads);
  const age = ageHours(snapshot.publishedAt ?? snapshot.createdAt);

  const engagement =
    reactions +
    scoreTotal * 0.8 +
    scoreCount * 0.5 +
    progressCount * 0.35 +
    replies * 1.2 +
    directReplies * 0.6 +
    reads * 0.2 +
    views * 0.05;
  const positiveEngagement = Math.max(engagement, 0);
  const freshness = 1 / Math.pow(age + 2, 1.15);

  const hotScore = positiveEngagement * freshness;
  const topScore = positiveEngagement;
  const trendingScore =
    (positiveEngagement + reads * 0.4 + views * 0.08) / Math.pow(age + 6, 0.85);
  const qualityScore =
    scoreCount > 0
      ? scoreTotal / Math.max(scoreCount, 1) + reactions * 0.08 + reads * 0.02
      : reactions * 0.1 + reads * 0.02;

  return {
    hotScore,
    topScore,
    trendingScore,
    qualityScore,
  };
}
