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
  ReactionUpdateInput,
} from "./reaction.types.ts";

/**
 * Mutation for creating a reaction
 */
export function useCreateReactionMutation(
  options?: Omit<
    UseMutationOptions<ReactionDTO, Error, ReactionCreateInput>,
    "mutationFn"
  >,
): ReturnType<typeof useMutation<ReactionDTO, Error, ReactionCreateInput>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReactionCreateInput) => reactionApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate summary and my reactions for the target
      queryClient.invalidateQueries({
        queryKey: reactionKeys.summary(variables.targetId),
      });
      queryClient.invalidateQueries({
        queryKey: reactionKeys.my(variables.targetId),
      });
      // Also refresh lists if used
      queryClient.invalidateQueries({ queryKey: reactionKeys.lists() });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for updating a reaction
 */
export function useUpdateReactionMutation(
  options?: Omit<
    UseMutationOptions<ReactionDTO, Error, ReactionUpdateInput>,
    "mutationFn"
  >,
): ReturnType<typeof useMutation<ReactionDTO, Error, ReactionUpdateInput>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReactionUpdateInput) => reactionApi.update(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate affected caches for target
      queryClient.invalidateQueries({
        queryKey: reactionKeys.summary(variables.targetId),
      });
      queryClient.invalidateQueries({
        queryKey: reactionKeys.my(variables.targetId),
      });
      queryClient.invalidateQueries({ queryKey: reactionKeys.lists() });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a reaction
 */
export function useDeleteReactionMutation(
  options?: Omit<
    UseMutationOptions<{ deleted: boolean }, Error, ReactionDeleteQuery>,
    "mutationFn"
  >,
): ReturnType<
  typeof useMutation<{ deleted: boolean }, Error, ReactionDeleteQuery>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (query: ReactionDeleteQuery) => reactionApi.remove(query),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate affected caches for target
      queryClient.invalidateQueries({
        queryKey: reactionKeys.summary(variables.targetId),
      });
      queryClient.invalidateQueries({
        queryKey: reactionKeys.my(variables.targetId),
      });
      queryClient.invalidateQueries({ queryKey: reactionKeys.lists() });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 */
export const reactionMutations = {
  useCreate: useCreateReactionMutation,
  useUpdate: useUpdateReactionMutation,
  useDelete: useDeleteReactionMutation,
};
