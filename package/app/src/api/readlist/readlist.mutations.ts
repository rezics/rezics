/**
 * React Query mutations for Readlist operations
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {readlistApi} from './readlist.api';
import {readlistKeys} from './readlist.keys';
import type {
  CreateReadlistInput,
  UpdateReadlistInput,
  ReadlistResponse,
} from '@package/contract';

/**
 * Mutation for creating a readlist
 */
export function useCreateReadlistMutation(
  options?: Omit<
    UseMutationOptions<ReadlistResponse, Error, CreateReadlistInput>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateReadlistInput) => readlistApi.create(input),
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate and refetch readlist lists
      queryClient.invalidateQueries({queryKey: readlistKeys.lists()});

      // Pre-populate the cache with the new readlist by its unitId (id)
      queryClient.setQueryData(readlistKeys.detail(data.id), data);

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    ...options,
  });
}

/**
 * Mutation for updating a readlist
 */
export function useUpdateReadlistMutation(
  options?: Omit<
    UseMutationOptions<
      ReadlistResponse,
      Error,
      {unitId: string; input: UpdateReadlistInput}
    >,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({unitId, input}) => readlistApi.update(unitId, input),
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update the cache for this specific readlist
      queryClient.setQueryData(readlistKeys.detail(variables.unitId), data);

      // Invalidate lists to ensure they're refreshed
      queryClient.invalidateQueries({queryKey: readlistKeys.lists()});

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    ...options,
  });
}

/**
 * Mutation for deleting a readlist
 */
export function useDeleteReadlistMutation(
  options?: Omit<
    UseMutationOptions<{message: string}, Error, string>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => readlistApi.remove(unitId),
    onSuccess: (data, unitId, onMutateResult, context) => {
      // Remove from cache
      queryClient.removeQueries({queryKey: readlistKeys.detail(unitId)});

      // Invalidate all lists
      queryClient.invalidateQueries({queryKey: readlistKeys.lists()});

      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
    ...options,
  });
}

/**
 * Combined mutations export
 */
export const readlistMutations = {
  useCreate: useCreateReadlistMutation,
  useUpdate: useUpdateReadlistMutation,
  useDelete: useDeleteReadlistMutation,
};
