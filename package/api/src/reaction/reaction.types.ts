/**
 * Types for Reaction API
 */

import type {ReactionListQuery} from '@package/contract';

export type ReactionSummary = {
  targetId: string;
  reaction: string;
  count: number;
};

/**
 * Data Transfer Object for a single reaction row
 */
export type ReactionDTO = {
  id: string;
  userId: string;
  targetId: string;
  reaction: string;
  createdAt: string;
};

/**
 * Response shape for listing reactions
 */
export type ReactionListResponse = {
  reactions: ReactionDTO[];
  total: number;
};

/**
 * Payload for creating a reaction
 */
export type ReactionCreateInput = {
  targetId: string;
  reaction: string;
};

/**
 * Payload for updating a reaction from one type to another
 */
export type ReactionUpdateInput = {
  targetId: string;
  oldReaction: string;
  newReaction: string;
};

/**
 * Query for deleting a reaction (matches server query fields)
 */
export type ReactionDeleteQuery = {
  targetId: string;
  reaction: string;
};

/**
 * Response for summary counts per reaction for a target
 */
export type ReactionSummaryResponse = {
  targetId: string;
  summary: Record<string, number>;
};

/**
 * Response for summary counts per reaction for many targets
 */
export type ReactionMultiSummaryResponse = {
  targetIds: string[];
  summaries: Record<string, Record<string, number>>;
};

/**
 * Response for current user's reactions on a target
 */
export type ReactionMyResponse = {
  userId: string;
  /**
   * All targetIds included in this query.
   * For single-target queries, this will be an array of length 1.
   */
  targetIds: string[];
  /**
   * Aggregated reactions keyed by targetId.
   * Each entry is the list of reaction types for that target.
   */
  reactionsByTarget: Record<string, string[]>;
};

/**
 * Bookmark tags tied to a bookmark reaction.
 * Returned by /reactions/bookmarks/:targetId
 */
export type BookmarkTagsResponse = {
  userId: string;
  targetId: string;
  tags: string[];
};

/**
 * Input for setting bookmark tags on a target.
 * The targetId is carried separately (path param) in API, but we bundle it here for convenience.
 */
export type BookmarkTagsUpdateInput = {
  targetId: string;
  tags: string[];
};

export type {ReactionListQuery};
