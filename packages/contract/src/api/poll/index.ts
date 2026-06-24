/**
 * Poll API — client entry point.
 * Poll API —— 客户端入口。
 */

// Types (re-exported from the contract for convenience)
// 类型（为方便起见从 contract 重新导出）
export type {
  CastPollVoteInput,
  CreatePollInput,
  CreatePollOptionInput,
  PollDTO,
  PollOptionDTO,
  PollResultsDTO,
  PollResultVisibility,
  PollVoteMode,
  WithdrawPollVoteInput,
} from "@rezics/contract";
// API client
// API 客户端
export { pollApi } from "./poll.api";
// Keys
// 键
export { pollKeys } from "./poll.keys";
// Mutations
// 变更
export {
  pollMutations,
  useCastPollVoteMutation,
  useCreatePollMutation,
  useWithdrawPollVoteMutation,
} from "./poll.mutations";
// Queries
// 查询
export { pollDetailQuery, pollQueries } from "./poll.queries";
