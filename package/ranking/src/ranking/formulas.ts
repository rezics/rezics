import type {
  RankingRecentVoteWindows,
  RankingScores,
  RankingSignalSnapshot,
} from "./types";

export const RANKING_FORMULA_VERSION = "ranking-v1";
const REDDIT_EPOCH_SECONDS = 1_134_028_003;
const REDDIT_HOT_SCALE_SECONDS = 45_000;
const WILSON_Z = 1.281551565545;

function ageHours(value?: string | null) {
  if (!value) return 24 * 365;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 24 * 365;
  return Math.max((Date.now() - time) / 3_600_000, 0);
}

function reactionWeight(counts: Record<string, number> = {}) {
  return (counts.upvote ?? 0) - (counts.downvote ?? 0);
}

function safeNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function epochSeconds(value?: string | null) {
  if (!value) return Date.now() / 1000;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Date.now() / 1000;
  return time / 1000;
}

export function netScore(ups: number, downs: number): number {
  return safeNumber(ups) - safeNumber(downs);
}

/**
 * Wilson lower bound with z=1.281551565545. This is the durable quality signal;
 * it is deliberately independent of creation time or recent activity.
 */
export function wilsonLowerBound(
  ups: number,
  downs: number,
  z = WILSON_Z,
): number {
  const positive = Math.max(safeNumber(ups), 0);
  const negative = Math.max(safeNumber(downs), 0);
  const n = positive + negative;
  if (n === 0) return 0;

  const phat = positive / n;
  return (
    (phat +
      (z * z) / (2 * n) -
      z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n)) /
    (1 + (z * z) / n)
  );
}

/**
 * Reddit hot score, matching archived `_sorts.pyx` semantics:
 * sign(s) * log10(max(abs(s), 1)) + (epoch_seconds - 1134028003) / 45000.
 */
export function redditHot(
  ups: number,
  downs: number,
  createdAt?: string | null,
): number {
  const score = netScore(ups, downs);
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  return (
    sign * order +
    (epochSeconds(createdAt) - REDDIT_EPOCH_SECONDS) / REDDIT_HOT_SCALE_SECONDS
  );
}

/**
 * Reddit controversy score: one-sided vote sets are not controversial; mixed
 * vote sets grow with total volume and balance.
 */
export function redditControversy(ups: number, downs: number): number {
  const positive = Math.max(safeNumber(ups), 0);
  const negative = Math.max(safeNumber(downs), 0);
  if (positive === 0 || negative === 0) return 0;
  return (
    (positive + negative) **
    (Math.min(positive, negative) / Math.max(positive, negative))
  );
}

export function risingScore(windows: RankingRecentVoteWindows = {}): number {
  const oneHour = netScore(windows.upvote1h ?? 0, windows.downvote1h ?? 0);
  const sixHour = netScore(windows.upvote6h ?? 0, windows.downvote6h ?? 0);
  const day = netScore(windows.upvote24h ?? 0, windows.downvote24h ?? 0);
  return Math.max(0, oneHour + sixHour * 0.45 + day * 0.15);
}

export function bestScore(input: {
  ups: number;
  downs: number;
  recentVotes?: RankingRecentVoteWindows;
}): number {
  const quality = wilsonLowerBound(input.ups, input.downs);
  const totalVotes =
    Math.max(safeNumber(input.ups), 0) + Math.max(safeNumber(input.downs), 0);
  const risingBoost =
    risingScore(input.recentVotes) / Math.sqrt(totalVotes + 12);
  return quality + risingBoost;
}

export function computeV1RankingScores(
  snapshot: RankingSignalSnapshot,
): RankingScores {
  const ups = safeNumber(snapshot.reactionCounts?.upvote);
  const downs = safeNumber(snapshot.reactionCounts?.downvote);
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
  const freshness = 1 / (age + 2) ** 1.15;

  const hotScore = redditHot(
    ups,
    downs,
    snapshot.publishedAt ?? snapshot.createdAt,
  );
  const topScore = netScore(ups, downs);
  const qualityScore = wilsonLowerBound(ups, downs);
  const computedRisingScore = risingScore(snapshot.recentVoteCounts);
  const computedBestScore = bestScore({
    ups,
    downs,
    recentVotes: snapshot.recentVoteCounts,
  });
  const controversyScore = redditControversy(ups, downs);
  const trendingScore =
    (positiveEngagement + reads * 0.4 + views * 0.08) / (age + 6) ** 0.85;

  return {
    bestScore: computedBestScore,
    hotScore,
    topScore,
    risingScore: computedRisingScore,
    controversyScore,
    trendingScore,
    qualityScore,
  };
}
