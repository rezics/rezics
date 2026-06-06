import type { AllowedReactionKind } from "@rezics/contract/reaction";

/**
 * Types for Reaction API (aligned with @rezics/contract/reaction)
 */

export type ReactionDTO = {
  id: string;
  userId: string;
  targetId: string;
  reaction: AllowedReactionKind;
  scopeKey: string;
  createdAt: string;
};

export type ReactionCreateInput = {
  targetId: string;
  reaction: AllowedReactionKind;
  scopeKey?: string;
};

export type ReactionDeleteQuery = {
  targetId: string;
  reaction: AllowedReactionKind;
  scopeKey?: string;
};

/** Response shape for GET /reactions/summary */
export type ReactionSummaryResponse = {
  summaries: Record<string, Record<string, number>>;
};

export type ShareSummaryResponse = {
  summaries: Record<string, { shareCount: number }>;
};

export type ShareCreateInput = {
  targetId: string;
};

export type ShareCreateResponse = {
  targetId: string;
  shareCount: number;
  created: boolean;
};

/** Response shape for GET /reactions/my */
export type ReactionMyResponse = {
  userId: string;
  reactionsByTarget: Record<string, string[]>;
};

/** Hydrated target metadata returned by `/profile/:userId/reactions/{given,received}`. */
export type ReactionHistoryTarget = {
  unitId: string;
  kind: string;
  title?: string;
  snippet?: string;
  href: string;
};

/** Hydrated actor metadata returned by `/profile/:userId/reactions/received`. */
export type ReactionHistoryActor = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  href: string;
};

export type ReactionHistoryGivenItem = {
  id: string;
  reaction: string;
  scopeKey: string;
  createdAt: string;
  target: ReactionHistoryTarget | null;
};

export type ReactionHistoryReceivedItem = ReactionHistoryGivenItem & {
  actor: ReactionHistoryActor;
};

export type ReactionHistoryPage<TItem> = {
  items: TItem[];
  nextCursor: string | null;
};

export type ReactionHistoryQuery = {
  reactions?: string;
  scopeKey?: string;
  cursor?: string;
  limit?: number;
};
