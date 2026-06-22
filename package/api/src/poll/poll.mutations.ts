/**
 * React Query mutations for Poll operations.
 */

import type {
  CastPollVoteInput,
  CreatePollInput,
  PollDTO,
  PollResultsDTO,
  WithdrawPollVoteInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { pollApi } from "./poll.api";
import { pollKeys } from "./poll.keys";

const pollInvalidates = [pollKeys.all()];

/**
 * Create a poll with options.
 */
export function useCreatePollMutation(
  options?: Omit<
    UseMutationOptions<PollDTO, Error, CreatePollInput>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: CreatePollInput) => pollApi.create(input),
    meta: { invalidates: pollInvalidates },
    ...options,
  });
}

/**
 * Cast or change a vote on a poll. The refreshed results are written straight
 * into the detail cache, and the query is invalidated to reconcile.
 */
export function useCastPollVoteMutation(
  pollUnitId: string,
  options?: Omit<
    UseMutationOptions<PollResultsDTO, Error, CastPollVoteInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CastPollVoteInput) => pollApi.vote(pollUnitId, input),
    meta: { invalidates: pollInvalidates },
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(pollKeys.detail(pollUnitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Withdraw a vote from a poll.
 */
export function useWithdrawPollVoteMutation(
  pollUnitId: string,
  options?: Omit<
    UseMutationOptions<PollResultsDTO, Error, WithdrawPollVoteInput | void>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input?: WithdrawPollVoteInput | void) =>
      pollApi.withdraw(pollUnitId, input ?? undefined),
    meta: { invalidates: pollInvalidates },
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(pollKeys.detail(pollUnitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const pollMutations = {
  useCreate: useCreatePollMutation,
  useVote: useCastPollVoteMutation,
  useWithdraw: useWithdrawPollVoteMutation,
};
