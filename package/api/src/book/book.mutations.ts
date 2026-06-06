/**
 * React Query mutations for Book operations
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
      queryClient.invalidateQueries({ queryKey: bookKeys.lists() });

      // Pre-populate the cache with the new book
      queryClient.setQueryData(bookKeys.detail(data.unitId), data);

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for updating a book
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
      const detailKey = bookKeys.detail(variables.unitId);
      await queryClient.cancelQueries({ queryKey: detailKey, exact: true });
      queryClient.setQueryData<BookResponse>(detailKey, (current) =>
        preserveCachedTranslations(data, current),
      );

      // Invalidate lists to ensure they're refreshed
      queryClient.invalidateQueries({ queryKey: bookKeys.lists() });

      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a book
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
      queryClient.removeQueries({ queryKey: bookKeys.detail(unitId) });

      // Invalidate all lists
      queryClient.invalidateQueries({ queryKey: bookKeys.lists() });

      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

/**
 * Mutation for updating a book's content structure
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
      queryClient.invalidateQueries({
        queryKey: bookKeys.contentStructure(variables.bookUnitId),
      });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 */
export const bookMutations = {
  useCreate: useCreateBookMutation,
  useUpdate: useUpdateBookMutation,
  useDelete: useDeleteBookMutation,
  useUpdateContentStructure: useUpdateContentStructureMutation,
};
