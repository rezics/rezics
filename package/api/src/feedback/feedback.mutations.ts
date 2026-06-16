/**
 * React Query mutations for Feedback operations
 * Feedback 操作的 React Query mutations。
 */

import type { CreateFeedbackInput, FeedbackDTO } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { feedbackApi } from "./feedback.api";
import { feedbackKeys } from "./feedback.keys";

/**
 * Mutation for creating feedback
 * 创建反馈的 mutation。
 */
export function useCreateFeedbackMutation(
  options?: Omit<
    UseMutationOptions<FeedbackDTO, Error, CreateFeedbackInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFeedbackInput) => feedbackApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update the cache for this specific feedback
      // 更新此条反馈的缓存。
      queryClient.setQueryData(feedbackKeys.detail(data.id), data);

      // Invalidate all feedback lists
      // 使所有反馈列表失效。
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all() });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for setting feedback resolved state
 * 设置反馈解决状态的 mutation。
 */
export function useSetFeedbackResolvedMutation(
  options?: Omit<
    UseMutationOptions<FeedbackDTO, Error, { id: string; resolved: boolean }>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, resolved }) => feedbackApi.setResolved(id, resolved),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update cache for this feedback
      // 更新此条反馈的缓存。
      queryClient.setQueryData(feedbackKeys.detail(variables.id), data);

      // Invalidate feedback lists
      // 使反馈列表失效。
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all() });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 * 组合的 mutations 导出。
 */
export const feedbackMutations = {
  useCreate: useCreateFeedbackMutation,
  useSetResolved: useSetFeedbackResolvedMutation,
};
