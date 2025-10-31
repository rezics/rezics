/**
 * React Query mutations for Chapter operations
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {chapterApi} from './chapter.api';
import {chapterKeys} from './chapter.keys';
import type {
  CreateChapterInput,
  UpdateChapterInput,
  ChapterResponse,
} from '@package/contract';

/**
 * Mutation for creating a chapter
 */
export function useCreateChapterMutation(
  options?: Omit<
    UseMutationOptions<ChapterResponse, Error, CreateChapterInput>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateChapterInput) => chapterApi.create(input),
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate and refetch chapter lists
      queryClient.invalidateQueries({queryKey: chapterKeys.lists()});

      // Pre-populate the cache with the new chapter by its unitId
      queryClient.setQueryData(chapterKeys.detail(data.unitId), data);

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    ...options,
  });
}

/**
 * Mutation for updating a chapter
 */
export function useUpdateChapterMutation(
  options?: Omit<
    UseMutationOptions<
      ChapterResponse,
      Error,
      {unitId: string; input: UpdateChapterInput}
    >,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({unitId, input}) => chapterApi.update(unitId, input),
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update the cache for this specific chapter
      queryClient.setQueryData(chapterKeys.detail(variables.unitId), data);

      // Invalidate lists to ensure they're refreshed
      queryClient.invalidateQueries({queryKey: chapterKeys.lists()});

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    ...options,
  });
}

/**
 * Mutation for deleting a chapter
 */
export function useDeleteChapterMutation(
  options?: Omit<
    UseMutationOptions<{message: string}, Error, string>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => chapterApi.remove(unitId),
    onSuccess: (data, unitId, onMutateResult, context) => {
      // Remove from cache
      queryClient.removeQueries({queryKey: chapterKeys.detail(unitId)});

      // Invalidate all lists
      queryClient.invalidateQueries({queryKey: chapterKeys.lists()});

      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
    ...options,
  });
}

/**
 * Combined mutations export
 */
export const chapterMutations = {
  useCreate: useCreateChapterMutation,
  useUpdate: useUpdateChapterMutation,
  useDelete: useDeleteChapterMutation,
};
