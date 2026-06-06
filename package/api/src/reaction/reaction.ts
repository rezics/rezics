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
  syncShareMutationCache,
  useCreateReactionMutation,
  useDeleteReactionMutation,
  useRecordShareMutation,
} from "./reaction.mutations";
// Query Configurations
export {
  batchReactionSummaryQuery,
  batchShareSummaryQuery,
  batchUserReactionsQuery,
  reactionMyQuery,
  reactionQueries,
  reactionSummaryQuery,
  useBatchReactionSummary,
  useBatchShareSummary,
  useBatchUserReactions,
  useGivenReactionsInfinite,
  useReceivedReactionsInfinite,
} from "./reaction.queries";
// Types
export type {
  ReactionCreateInput,
  ReactionDeleteQuery,
  ReactionDTO,
  ReactionHistoryActor,
  ReactionHistoryGivenItem,
  ReactionHistoryPage,
  ReactionHistoryQuery,
  ReactionHistoryReceivedItem,
  ReactionHistoryTarget,
  ReactionMyResponse,
  ReactionSummaryResponse,
  ShareCreateInput,
  ShareCreateResponse,
  ShareSummaryResponse,
} from "./reaction.types";
export {
  type UseReactionDataReturn,
  useReactionData,
} from "./useReactionData";
export {
  type UseReactionHydrationOptions,
  type UseReactionHydrationReturn,
  useReactionHydration,
} from "./useReactionHydration";
