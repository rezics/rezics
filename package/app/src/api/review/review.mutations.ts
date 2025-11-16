/**
 * React Query mutations for Review operations
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {reviewApi} from './review.api';
import {reviewKeys} from './review.keys';
import type {
  CreateReviewInput,
  UpdateReviewInput,
  ReviewResponse,
} from '@package/contract';

/**
 * Mutation for creating a review
 */
export function useCreateReviewMutation(
  options?: Omit<
    UseMutationOptions<ReviewResponse, Error, CreateReviewInput>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateReviewInput) => reviewApi.create(input),
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate and refetch review lists
      queryClient.invalidateQueries({queryKey: reviewKeys.lists()});

      // Pre-populate the cache with the new review
      queryClient.setQueryData(reviewKeys.detail(data.unitId), data);

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    ...options,
  });
}

/**
 * Mutation for updating a review
 */
export function useUpdateReviewMutation(
  options?: Omit<
    UseMutationOptions<
      ReviewResponse,
      Error,
      {id: string; input: UpdateReviewInput}
    >,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({id, input}) => reviewApi.update(id, input),
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update the cache for this specific review
      queryClient.setQueryData(reviewKeys.detail(variables.id), data);

      // Invalidate lists to ensure they're refreshed
      queryClient.invalidateQueries({queryKey: reviewKeys.lists()});

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    ...options,
  });
}

/**
 * Mutation for deleting a review
 */
export function useDeleteReviewMutation(
  options?: Omit<
    UseMutationOptions<{message: string}, Error, string>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reviewApi.remove(id),
    onSuccess: (data, id, onMutateResult, context) => {
      // Remove from cache
      queryClient.removeQueries({queryKey: reviewKeys.detail(id)});

      // Invalidate all lists
      queryClient.invalidateQueries({queryKey: reviewKeys.lists()});

      options?.onSuccess?.(data, id, onMutateResult, context);
    },
    ...options,
  });
}

/**
 * Combined mutations export
 */
export const reviewMutations = {
  useCreate: useCreateReviewMutation,
  useUpdate: useUpdateReviewMutation,
  useDelete: useDeleteReviewMutation,
};
