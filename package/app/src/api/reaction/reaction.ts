/**
 * Reaction API - Main entry point
 * Provides a unified interface for all reaction-related operations
 *
 * File organization:
 * - reaction.types.ts: TypeScript types and interfaces
 * - reaction.keys.ts: React Query key factory
 * - reaction.api.ts: API client functions
 * - reaction.queries.ts: Query configurations
 * - reaction.mutations.ts: Mutation hooks
 * - reaction.ts: Main entry (this file) - unified exports
 */

// Types
export type {
  ReactionDTO,
  ReactionListResponse,
  ReactionCreateInput,
  ReactionUpdateInput,
  ReactionDeleteQuery,
  ReactionSummaryResponse,
  ReactionMyResponse,
  ReactionListQuery,
} from './reaction.types.ts';
// Re-exporting from .ts file with explicit extension can be required by some configs

// Query Keys
export {reactionKeys} from './reaction.keys';

// API Client
export {reactionApi} from './reaction.api';

// Query Configurations
export {
  reactionQueries,
  reactionListQuery,
  reactionSummaryQuery,
  reactionMyQuery,
} from './reaction.queries';

// Mutation Hooks
export {
  reactionMutations,
  useCreateReactionMutation,
  useUpdateReactionMutation,
  useDeleteReactionMutation,
} from './reaction.mutations';
