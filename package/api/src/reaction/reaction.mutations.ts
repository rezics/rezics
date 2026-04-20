/**
 * React Query mutations for Reaction operations
 */

import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { reactionApi } from "./reaction.api";
import { reactionKeys } from "./reaction.keys";
import type {
  ReactionCreateInput,
  ReactionDeleteQuery,
  ReactionDTO,
} from "./reaction.types";

export function useCreateReactionMutation(
  options?: Omit<
    UseMutationOptions<ReactionDTO, Error, ReactionCreateInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReactionCreateInput) => reactionApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: reactionKeys.summaries(),
      });
      queryClient.invalidateQueries({
        queryKey: reactionKeys.mine(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteReactionMutation(
  options?: Omit<
    UseMutationOptions<{ deleted: boolean }, Error, ReactionDeleteQuery>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (query: ReactionDeleteQuery) => reactionApi.remove(query),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: reactionKeys.summaries(),
      });
      queryClient.invalidateQueries({
        queryKey: reactionKeys.mine(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const reactionMutations = {
  useCreate: useCreateReactionMutation,
  useDelete: useDeleteReactionMutation,
};
