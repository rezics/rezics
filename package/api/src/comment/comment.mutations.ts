/**
 * React Query mutations for Comment operations
 */

import type {
  CommentDTO,
  CreateCommentInput,
  UpdateCommentInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { commentApi } from "./comment.api";
import { commentKeys } from "./comment.keys";

/**
 * Mutation for creating a comment
 */
export function useCreateCommentMutation(
  options?: Omit<
    UseMutationOptions<CommentDTO, Error, CreateCommentInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCommentInput) => commentApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate lists under the root post/tree
      queryClient.invalidateQueries({ queryKey: commentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: commentKeys.commentTrees() });

      // Optionally seed detail cache (assumes data.id is unitId)
      if (data.id) {
        queryClient.setQueryData(commentKeys.detail(data.id), data);
      }

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for updating a comment
 */
export function useUpdateCommentMutation(
  options?: Omit<
    UseMutationOptions<
      CommentDTO,
      Error,
      { unitId: string; input: UpdateCommentInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }) => commentApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: commentKeys.commentTrees() });

      queryClient.setQueryData(commentKeys.detail(variables.unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a comment
 */
export function useDeleteCommentMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => commentApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      // Remove detail cache
      queryClient.removeQueries({ queryKey: commentKeys.detail(unitId) });
      // Invalidate lists for freshness
      queryClient.invalidateQueries({ queryKey: commentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: commentKeys.commentTrees() });
      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 */
export const commentMutations = {
  useCreate: useCreateCommentMutation,
  useUpdate: useUpdateCommentMutation,
  useDelete: useDeleteCommentMutation,
};
