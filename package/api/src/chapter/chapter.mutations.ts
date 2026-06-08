/**
 * React Query mutations for Chapter operations
 * Chapter 操作的 React Query mutation。
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
      // 使 chapter 列表失效并重新获取
      queryClient.invalidateQueries({ queryKey: chapterKeys.lists() });

      // Pre-populate the cache with the new chapter by its unitId
      // 按 unitId 用新 chapter 预填充缓存
      queryClient.setQueryData(chapterKeys.detail(data.unitId), data);

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

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
      // 更新该特定 chapter 的缓存
      queryClient.setQueryData(chapterKeys.detail(variables.unitId), data);

      // Invalidate lists to ensure they're refreshed
      // 使列表失效以确保它们被刷新
      queryClient.invalidateQueries({ queryKey: chapterKeys.lists() });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

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
      // 从缓存中移除
      queryClient.removeQueries({ queryKey: chapterKeys.detail(unitId) });

      // Invalidate all lists
      // 使所有列表失效
      queryClient.invalidateQueries({ queryKey: chapterKeys.lists() });

      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

/**
 * Mutation for materializing a BookContentStructure node into a chapter Unit.
 * 将 BookContentStructure 节点物化为 chapter Unit 的 mutation。
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
      chapterApi.materializeNode(bookUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: bookKeys.contentStructure(variables.bookUnitId),
      });
      queryClient.invalidateQueries({ queryKey: chapterKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: chapterKeys.byTargetUnit(variables.bookUnitId),
      });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const chapterMutations = {
  useCreate: useCreateChapterMutation,
  useUpdate: useUpdateChapterMutation,
  useDelete: useDeleteChapterMutation,
  useMaterialize: useMaterializeChapterMutation,
};
