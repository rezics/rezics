/**
 * Reaction API - Main entry point
 */

// API Client
export { reactionApi } from "./reaction.api";
// Query Keys
export { reactionKeys } from "./reaction.keys";
// Mutation Hooks
export {
  reactionMutations,
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from "./reaction.mutations";
// Query Configurations
export {
  batchReactionSummaryQuery,
  batchUserReactionsQuery,
  reactionMyQuery,
  reactionQueries,
  reactionSummaryQuery,
  useBatchReactionSummary,
  useBatchUserReactions,
} from "./reaction.queries";
export {
  useReactionData,
  type UseReactionDataReturn,
} from "./useReactionData";
export {
  useReactionHydration,
  type UseReactionHydrationOptions,
  type UseReactionHydrationReturn,
} from "./useReactionHydration";
// Types
export type {
  ReactionCreateInput,
  ReactionDeleteQuery,
  ReactionDTO,
  ReactionMyResponse,
  ReactionSummaryResponse,
} from "./reaction.types";
