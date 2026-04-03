/**
 * React Query mutations for Feedback operations
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {feedbackApi} from './feedback.api';
import {feedbackKeys} from './feedback.keys';
import type {CreateFeedbackInput, FeedbackDTO} from '@rezics/contract';

/**
 * Mutation for creating feedback
 */
export function useCreateFeedbackMutation(
  options?: Omit<
    UseMutationOptions<FeedbackDTO, Error, CreateFeedbackInput>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFeedbackInput) => feedbackApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update the cache for this specific feedback
      queryClient.setQueryData(feedbackKeys.detail(data.id), data);

      // Invalidate all feedback lists
      queryClient.invalidateQueries({queryKey: feedbackKeys.all()});

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for setting feedback resolved state
 */
export function useSetFeedbackResolvedMutation(
  options?: Omit<
    UseMutationOptions<FeedbackDTO, Error, {id: string; resolved: boolean}>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({id, resolved}) => feedbackApi.setResolved(id, resolved),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update cache for this feedback
      queryClient.setQueryData(feedbackKeys.detail(variables.id), data);

      // Invalidate feedback lists
      queryClient.invalidateQueries({queryKey: feedbackKeys.all()});

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 */
export const feedbackMutations = {
  useCreate: useCreateFeedbackMutation,
  useSetResolved: useSetFeedbackResolvedMutation,
};
