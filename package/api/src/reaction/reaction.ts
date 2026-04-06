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
  ReactionCreateInput,
  ReactionDeleteQuery,
  ReactionDTO,
  ReactionListQuery,
  ReactionListResponse,
  ReactionMyResponse,
  ReactionSummaryResponse,
  ReactionUpdateInput,
} from "./reaction.types.ts";

// Re-exporting from .ts file with explicit extension can be required by some configs

// API Client
export { reactionApi } from "./reaction.api";
// Query Keys
export { reactionKeys } from "./reaction.keys";
// Mutation Hooks
export {
  reactionMutations,
  useCreateReactionMutation,
  useDeleteReactionMutation,
  useUpdateReactionMutation,
} from "./reaction.mutations";
// Query Configurations
export {
  reactionListQuery,
  reactionMyQuery,
  reactionQueries,
  reactionSummaryQuery,
} from "./reaction.queries";
