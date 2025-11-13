/**
 * React Query keys for Reaction queries
 * Following TanStack Query best practices for key management
 */

import type {ReactionListQuery} from './reaction.types.ts';

export const reactionKeys = {
  /** Base key for all reaction queries */
  all: () => ['reactions'] as const,

  /** Keys for list queries */
  lists: () => [...reactionKeys.all(), 'list'] as const,
  list: (filters?: ReactionListQuery) =>
    [...reactionKeys.lists(), filters] as const,

  /** Keys for summary queries (per target) */
  summaries: () => [...reactionKeys.all(), 'summary'] as const,
  summary: (targetType: string, targetId: string) =>
    [...reactionKeys.summaries(), {targetType, targetId}] as const,

  /** Keys for current user's reactions on a target */
  mine: () => [...reactionKeys.all(), 'my'] as const,
  my: (targetType: string, targetId: string) =>
    [...reactionKeys.mine(), {targetType, targetId}] as const,
} as const;
