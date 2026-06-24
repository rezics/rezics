export type RankKind = "content" | "post" | "comment";
export type ScopeKind = "global" | "realm" | "work" | "tag" | "parent";

export type RankingScope = {
  kind: ScopeKind;
  id?: string | null;
};

export type RankingScores = {
  bestScore: number;
  hotScore: number;
  topScore: number;
  risingScore: number;
  controversyScore: number;
  trendingScore: number;
  qualityScore: number;
};

export type RankingRecentVoteWindows = {
  upvote1h?: number;
  downvote1h?: number;
  upvote6h?: number;
  downvote6h?: number;
  upvote24h?: number;
  downvote24h?: number;
};

export type RankingSignalSnapshot = {
  unitId: string;
  rankKind: RankKind;
  scope: RankingScope;
  /**
   * `ranking-v1` intentionally excludes share/reference counts. They are exposed
   * as search/display signals; adding them to ranking should bump the formula
   * version and add calibration tests.
   */
  publishedAt?: string | null;
  createdAt?: string | null;
  replyCount?: number;
  directReplyCount?: number;
  scoreTotal?: number;
  scoreCount?: number;
  progressCount?: number;
  reactionCounts?: Record<string, number>;
  recentVoteCounts?: RankingRecentVoteWindows;
  bucketSignals?: {
    views: number;
    reads: number;
  };
};

export const ZERO_RANKING_SCORES: RankingScores = {
  bestScore: 0,
  hotScore: 0,
  topScore: 0,
  risingScore: 0,
  controversyScore: 0,
  trendingScore: 0,
  qualityScore: 0,
};

export function scopeKey(scope: RankingScope): string {
  return scope.id ?? scope.kind;
}
