/**
 * React Query mutations for Book operations
 * 用于 Book 操作的 React Query mutations
 */

import type {
  BookContentStructureItem,
  BookResponse,
  CreateBookInput,
  EditorialPatchSubmission,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { preserveCachedTranslations } from "../react-query/cache-coherence";
import { bookApi } from "./book.api";
import { bookKeys } from "./book.keys";

/**
 * Mutation for creating a book
 * 用于创建 book 的 mutation
 */
export function useCreateBookMutation(
  options?: Omit<
    UseMutationOptions<BookResponse, Error, CreateBookInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBookInput) => bookApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate and refetch book lists
      // 使 book 列表失效并重新拉取
      queryClient.invalidateQueries({ queryKey: bookKeys.lists() });

      // Pre-populate the cache with the new book
      // 用新建的 book 预填充缓存
      queryClient.setQueryData(bookKeys.detail(data.unitId), data);

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for updating a book
 * 用于更新 book 的 mutation
 */
export function useUpdateBookMutation(
  options?: Omit<
    UseMutationOptions<
      BookResponse,
      Error,
      { unitId: string; input: EditorialPatchSubmission }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }) => bookApi.update(unitId, input),
    ...options,
    onSuccess: async (data, variables, onMutateResult, context) => {
      // Update the cache for this specific book
      // 更新该 book 对应的缓存
      const detailKey = bookKeys.detail(variables.unitId);
      await queryClient.cancelQueries({ queryKey: detailKey, exact: true });
      queryClient.setQueryData<BookResponse>(detailKey, (current) =>
        preserveCachedTranslations(data, current),
      );

      // Invalidate lists to ensure they're refreshed
      // 使列表失效以确保其刷新
      queryClient.invalidateQueries({ queryKey: bookKeys.lists() });

      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a book
 * 用于删除 book 的 mutation
 */
export function useDeleteBookMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => bookApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      // Remove from cache
      // 从缓存中移除
      queryClient.removeQueries({ queryKey: bookKeys.detail(unitId) });

      // Invalidate all lists
      // 使所有列表失效
      queryClient.invalidateQueries({ queryKey: bookKeys.lists() });

      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

/**
 * Mutation for updating a book's content structure
 * 用于更新 book 内容结构的 mutation
 */
export function useUpdateContentStructureMutation(
  options?: Omit<
    UseMutationOptions<
      any,
      Error,
      {
        bookUnitId: string;
        nodes: BookContentStructureItem[];
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookUnitId, nodes }) =>
      bookApi.updateContentStructure(bookUnitId, nodes),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate the cached content structure for this book
      // 使该 book 已缓存的内容结构失效
      queryClient.invalidateQueries({
        queryKey: bookKeys.contentStructure(variables.bookUnitId),
      });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 * 组合后的 mutations 导出
 */
export const bookMutations = {
  useCreate: useCreateBookMutation,
  useUpdate: useUpdateBookMutation,
  useDelete: useDeleteBookMutation,
  useUpdateContentStructure: useUpdateContentStructureMutation,
};
