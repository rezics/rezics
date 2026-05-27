export type RankKind = "content" | "post" | "comment";
export type ScopeKind = "global" | "realm" | "work" | "tag" | "parent";

export type RankingScope = {
  kind: ScopeKind;
  id?: string | null;
};

export type RankingScores = {
  hotScore: number;
  topScore: number;
  trendingScore: number;
  qualityScore: number;
};

export type RankingSignalSnapshot = {
  unitId: string;
  rankKind: RankKind;
  scope: RankingScope;
  publishedAt?: string | null;
  createdAt?: string | null;
  replyCount?: number;
  directReplyCount?: number;
  scoreTotal?: number;
  scoreCount?: number;
  progressCount?: number;
  reactionCounts?: Record<string, number>;
  bucketSignals?: {
    views: number;
    reads: number;
  };
};

export const ZERO_RANKING_SCORES: RankingScores = {
  hotScore: 0,
  topScore: 0,
  trendingScore: 0,
  qualityScore: 0,
};

export function scopeKey(scope: RankingScope): string {
  return scope.id ?? scope.kind;
}
