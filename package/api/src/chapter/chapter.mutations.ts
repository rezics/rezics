/**
 * React Query mutations for Chapter operations
 */

import type {
  ChapterMaterializationRequest,
  ChapterMaterializationResponse,
  ChapterResponse,
  CreateChapterInput,
  UpdateChapterInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { bookKeys } from "../book/book.keys";
import { chapterApi } from "./chapter.api";
import { chapterKeys } from "./chapter.keys";

/**
 * Mutation for creating a chapter
 */
export function useCreateChapterMutation(
  options?: Omit<
    UseMutationOptions<ChapterResponse, Error, CreateChapterInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateChapterInput) => chapterApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate and refetch chapter lists
      queryClient.invalidateQueries({ queryKey: chapterKeys.lists() });

      // Pre-populate the cache with the new chapter by its unitId
      queryClient.setQueryData(chapterKeys.detail(data.unitId), data);

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
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
      { unitId: string; input: UpdateChapterInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }) => chapterApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update the cache for this specific chapter
      queryClient.setQueryData(chapterKeys.detail(variables.unitId), data);

      // Invalidate lists to ensure they're refreshed
      queryClient.invalidateQueries({ queryKey: chapterKeys.lists() });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a chapter
 */
export function useDeleteChapterMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => chapterApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: chapterKeys.detail(unitId) });

      // Invalidate all lists
      queryClient.invalidateQueries({ queryKey: chapterKeys.lists() });

      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

/**
 * Mutation for materializing a BookIndex node into a chapter Unit.
 */
export function useMaterializeChapterMutation(
  options?: Omit<
    UseMutationOptions<
      ChapterMaterializationResponse,
      Error,
      { bookUnitId: string; input: ChapterMaterializationRequest }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookUnitId, input }) =>
      chapterApi.materializeByBookPath(bookUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: bookKeys.chapterIndex(variables.bookUnitId),
      });
      queryClient.invalidateQueries({ queryKey: chapterKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: chapterKeys.byTargetUnit(variables.bookUnitId),
      });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 */
export const chapterMutations = {
  useCreate: useCreateChapterMutation,
  useUpdate: useUpdateChapterMutation,
  useDelete: useDeleteChapterMutation,
  useMaterialize: useMaterializeChapterMutation,
};
