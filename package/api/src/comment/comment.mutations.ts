import type {
  CommentResponse,
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

export function useCreateCommentMutation(
  options?: Omit<
    UseMutationOptions<CommentResponse, Error, CreateCommentInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: commentApi.create,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateCommentMutation(
  options?: Omit<
    UseMutationOptions<
      CommentResponse,
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
      queryClient.setQueryData(commentKeys.detail(variables.unitId), data);
      queryClient.invalidateQueries({ queryKey: commentKeys.all() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteCommentMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, { unitId: string }>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId }) => commentApi.delete(unitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all() });
      queryClient.invalidateQueries({
        queryKey: commentKeys.detail(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const commentMutations = {
  useCreate: useCreateCommentMutation,
  useUpdate: useUpdateCommentMutation,
  useDelete: useDeleteCommentMutation,
};
