/**
 * Poll API — client entry point.
 */

// Types (re-exported from the contract for convenience)
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
export { pollApi } from "./poll.api";
// Keys
export { pollKeys } from "./poll.keys";
// Mutations
export {
  pollMutations,
  useCastPollVoteMutation,
  useCreatePollMutation,
  useWithdrawPollVoteMutation,
} from "./poll.mutations";
// Queries
export { pollDetailQuery, pollQueries } from "./poll.queries";
