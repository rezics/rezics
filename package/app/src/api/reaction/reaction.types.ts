/**
 * Types for Reaction API
 */

import type {ReactionListQuery} from '@package/contract';

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
 * Response for current user's reactions on a target
 */
export type ReactionMyResponse = {
  userId: string;
  targetId: string;
  reactions: string[];
};

export type {ReactionListQuery};
