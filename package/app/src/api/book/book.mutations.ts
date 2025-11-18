/**
 * React Query mutations for Book operations
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {bookApi} from './book.api';
import {bookKeys} from './book.keys';
import type {
  CreateBookInput,
  UpdateBookInput,
  BookResponse,
} from '@package/contract';

/**
 * Mutation for creating a book
 */
export function useCreateBookMutation(
  options?: Omit<
    UseMutationOptions<BookResponse, Error, CreateBookInput>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBookInput) => bookApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate and refetch book lists
      queryClient.invalidateQueries({queryKey: bookKeys.lists()});

      // Optionally pre-populate the cache with the new book
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
      {postId: string; input: UpdateBookInput}
    >,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({postId, input}) => bookApi.update(postId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update the cache for this specific book
      queryClient.setQueryData(bookKeys.detail(variables.postId), data);

      // Invalidate lists to ensure they're refreshed
      queryClient.invalidateQueries({queryKey: bookKeys.lists()});

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a book
 */
export function useDeleteBookMutation(
  options?: Omit<
    UseMutationOptions<{message: string}, Error, string>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => bookApi.remove(postId),
    ...options,
    onSuccess: (data, postId, onMutateResult, context) => {
      // Remove from cache
      queryClient.removeQueries({queryKey: bookKeys.detail(postId)});

      // Invalidate all lists
      queryClient.invalidateQueries({queryKey: bookKeys.lists()});

      options?.onSuccess?.(data, postId, onMutateResult, context);
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
};
