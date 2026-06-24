/**
 * Reaction API - Main entry point
 * Reaction API —— 主入口。
 */

// API Client
// API 客户端。
export { reactionApi } from "./reaction.api";
// Query Keys
// 查询键。
export { reactionKeys } from "./reaction.keys";
// Mutation Hooks
// 变更 Hooks。
export {
  reactionMutations,
  syncShareMutationCache,
  useCreateReactionMutation,
  useDeleteReactionMutation,
  useRecordShareMutation,
} from "./reaction.mutations";
// Query Configurations
// 查询配置。
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
// 类型。
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
