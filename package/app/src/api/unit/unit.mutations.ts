/**
 * React Query mutations for Unit operations
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {unitApi} from './unit.api';
import {unitKeys} from './unit.keys';
import type {
  CreateUnitInput,
  UpdateUnitInput,
  UnitResponse,
} from '@package/contract';

/**
 * Mutation for creating a unit
 */
export function useCreateUnitMutation(
  options?: Omit<
    UseMutationOptions<UnitResponse, Error, CreateUnitInput>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUnitInput) => unitApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate and refetch unit lists
      queryClient.invalidateQueries({queryKey: unitKeys.lists()});

      // Pre-populate the cache with the new unit
      if ((data as any)?.id) {
        queryClient.setQueryData(unitKeys.detail((data as any).id), data);
      }

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for updating a unit
 */
export function useUpdateUnitMutation(
  options?: Omit<
    UseMutationOptions<
      UnitResponse,
      Error,
      {unitId: string; input: UpdateUnitInput}
    >,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({unitId, input}) => unitApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update the cache for this specific unit
      queryClient.setQueryData(unitKeys.detail(variables.unitId), data);

      // Invalidate lists to ensure they're refreshed
      queryClient.invalidateQueries({queryKey: unitKeys.lists()});

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a unit
 */
export function useDeleteUnitMutation(
  options?: Omit<
    UseMutationOptions<{message: string}, Error, string>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => unitApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      // Remove from cache
      queryClient.removeQueries({queryKey: unitKeys.detail(unitId)});

      // Invalidate all lists
      queryClient.invalidateQueries({queryKey: unitKeys.lists()});

      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 */
export const unitMutations = {
  useCreate: useCreateUnitMutation,
  useUpdate: useUpdateUnitMutation,
  useDelete: useDeleteUnitMutation,
};
