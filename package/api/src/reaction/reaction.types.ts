/**
 * Types for Reaction API (aligned with @rezics/contract/reaction)
 */

export type ReactionDTO = {
  id: string;
  userId: string;
  targetId: string;
  reaction: string;
  createdAt: string;
};

export type ReactionCreateInput = {
  targetId: string;
  reaction: string;
};

export type ReactionDeleteQuery = {
  targetId: string;
  reaction: string;
};

/** Response shape for GET /reactions/summary */
export type ReactionSummaryResponse = {
  summaries: Record<string, Record<string, number>>;
};

/** Response shape for GET /reactions/my */
export type ReactionMyResponse = {
  userId: string;
  reactionsByTarget: Record<string, string[]>;
};
