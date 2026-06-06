export interface ReactionDto {
  id: string;
  userId: string;
  targetId: string;
  reaction: string;
  scopeKey: string;
  createdAt: string;
}

/** Map of reaction type → count for a single target. */
export type ReactionCountMap = Record<string, number>;

/** Response shape for GET /reactions/summary. */
export interface ReactionSummaryResponse {
  summaries: Record<string, ReactionCountMap>;
}

/** Response shape for GET /reactions/my. */
export interface UserReactionsResponse {
  userId: string;
  reactionsByTarget: Record<string, string[]>;
}
