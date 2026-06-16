export interface ReactionDto {
  id: string;
  userId: string;
  targetId: string;
  reaction: string;
  contextUnitId: string | null;
  createdAt: string;
}

/**
 * Map of reaction type → count for a single target.
 * 单个目标的反应类型 → 计数映射。
 */
export type ReactionCountMap = Record<string, number>;

/**
 * Response shape for GET /reactions/summary.
 * GET /reactions/summary 的响应结构。
 */
export interface ReactionSummaryResponse {
  summaries: Record<string, ReactionCountMap>;
}

/**
 * Response shape for GET /reactions/my.
 * GET /reactions/my 的响应结构。
 */
export interface UserReactionsResponse {
  userId: string;
  reactionsByTarget: Record<string, string[]>;
}
