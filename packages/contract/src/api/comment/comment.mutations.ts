import type {
  CommentModerationInput,
  CommentResponse,
  CreateCommentInput,
  UpdateCommentInput,
} from "@rezics/contract";
import {
  type QueryClient,
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { governanceKeys } from "../governance/governance.keys";
import { postKeys } from "../post/post.keys";
import { commentApi } from "./comment.api";
import { commentKeys } from "./comment.keys";

export function invalidateCommentModerationQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  comment: Pick<CommentResponse, "id" | "rootUnitId" | "realmUnitId">,
) {
  queryClient.invalidateQueries({ queryKey: commentKeys.all() });
  queryClient.invalidateQueries({ queryKey: commentKeys.detail(comment.id) });
  queryClient.invalidateQueries({
    queryKey: postKeys.detail(comment.rootUnitId),
  });
  queryClient.invalidateQueries({
    queryKey: postKeys.moderationOverlays(comment.realmUnitId, [comment.id]),
  });
  queryClient.invalidateQueries({
    queryKey: governanceKeys.moderationOverlays(
      "comment",
      [comment.id],
      comment.realmUnitId,
    ),
  });
}

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
      // Invalidate the parent post so replyCount stays in sync.
      // 使父帖失效以保持 replyCount 同步。
      if (data.rootUnitId) {
        queryClient.invalidateQueries({
          queryKey: postKeys.detail(data.rootUnitId),
        });
      }
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateCommentMutation(
  options?: Omit<
    UseMutationOptions<
      CommentResponse,
      Error,
      { id: string; input: UpdateCommentInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => commentApi.update(id, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(commentKeys.detail(variables.id), data);
      queryClient.invalidateQueries({ queryKey: commentKeys.all() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useModerateCommentMutation(
  options?: Omit<
    UseMutationOptions<
      CommentResponse,
      Error,
      { id: string; input: CommentModerationInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => commentApi.moderate(id, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(commentKeys.detail(variables.id), data);
      invalidateCommentModerationQueries(queryClient, data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteCommentMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, { id: string }>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => commentApi.delete(id),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all() });
      queryClient.invalidateQueries({
        queryKey: commentKeys.detail(variables.id),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const commentMutations = {
  useCreate: useCreateCommentMutation,
  useUpdate: useUpdateCommentMutation,
  useModerate: useModerateCommentMutation,
  useDelete: useDeleteCommentMutation,
};
