/**
 * React Query mutations for Post operations
 */

import type {
  CreatePostInput,
  PostResponse,
  UpdatePostInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { postApi } from "./post.api";
import { postKeys } from "./post.keys";

/**
 * Mutation for creating a post
 */
export function useCreatePostMutation(
  options?: Omit<
    UseMutationOptions<PostResponse, Error, CreatePostInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePostInput) => postApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate lists broadly
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });

      // Invalidate target-specific queries if post is attached to a unit
      if (variables.targetUnitId) {
        queryClient.invalidateQueries({
          queryKey: postKeys.byTarget(variables.targetUnitId),
        });
      }

      // Invalidate thread/reply queries if this is a reply
      if (variables.parentPostUnitId) {
        queryClient.invalidateQueries({
          queryKey: postKeys.replies(variables.parentPostUnitId),
        });
      }

      // Pre-populate detail cache
      queryClient.setQueryData(postKeys.detail(data.unitId), data);

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for updating a post
 */
export function useUpdatePostMutation(
  options?: Omit<
    UseMutationOptions<
      PostResponse,
      Error,
      { unitId: string; input: UpdatePostInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }) => postApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update the cache for this specific post
      queryClient.setQueryData(postKeys.detail(variables.unitId), data);

      // Invalidate lists to ensure they're refreshed
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a post
 */
export function useDeletePostMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => postApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: postKeys.detail(unitId) });

      // Invalidate all lists
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });

      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 */
export const postMutations = {
  useCreate: useCreatePostMutation,
  useUpdate: useUpdatePostMutation,
  useDelete: useDeletePostMutation,
};
