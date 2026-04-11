/**
 * React Query mutations for Shelf operations
 */

import type {
  AddShelfItemInput,
  CreateShelfInput,
  ShelfItemDTO,
  ShelfResponse,
  UpdateShelfInput,
  UpdateShelfItemInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { shelfApi } from "./shelf.api";
import { shelfKeys } from "./shelf.keys";

/**
 * Mutation for creating a shelf
 */
export function useCreateShelfMutation(
  options?: Omit<
    UseMutationOptions<ShelfResponse, Error, CreateShelfInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateShelfInput) => shelfApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate and refetch shelf lists
      queryClient.invalidateQueries({ queryKey: shelfKeys.lists() });

      // Pre-populate the cache with the new shelf
      queryClient.setQueryData(shelfKeys.detail(data.unitId), data);

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for updating a shelf
 */
export function useUpdateShelfMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfResponse,
      Error,
      { unitId: string; input: UpdateShelfInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }) => shelfApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update the cache for this specific shelf
      queryClient.setQueryData(shelfKeys.detail(variables.unitId), data);

      // Invalidate lists to ensure they're refreshed
      queryClient.invalidateQueries({ queryKey: shelfKeys.lists() });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a shelf
 */
export function useDeleteShelfMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => shelfApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: shelfKeys.detail(unitId) });

      // Invalidate all lists
      queryClient.invalidateQueries({ queryKey: shelfKeys.lists() });

      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

/**
 * Mutation for adding an item to a shelf
 */
export function useAddShelfItemMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfItemDTO,
      Error,
      { shelfUnitId: string; input: AddShelfItemInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shelfUnitId, input }) =>
      shelfApi.addItem(shelfUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate the shelf detail to refetch with new items
      queryClient.invalidateQueries({
        queryKey: shelfKeys.detail(variables.shelfUnitId),
      });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for updating a shelf item
 */
export function useUpdateShelfItemMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfItemDTO,
      Error,
      {
        shelfUnitId: string;
        itemUnitId: string;
        input: UpdateShelfItemInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shelfUnitId, itemUnitId, input }) =>
      shelfApi.updateItem(shelfUnitId, itemUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate the shelf detail to refetch with updated items
      queryClient.invalidateQueries({
        queryKey: shelfKeys.detail(variables.shelfUnitId),
      });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for removing an item from a shelf
 */
export function useRemoveShelfItemMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { shelfUnitId: string; itemUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shelfUnitId, itemUnitId }) =>
      shelfApi.removeItem(shelfUnitId, itemUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate the shelf detail to refetch with removed item
      queryClient.invalidateQueries({
        queryKey: shelfKeys.detail(variables.shelfUnitId),
      });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 */
export const shelfMutations = {
  useCreate: useCreateShelfMutation,
  useUpdate: useUpdateShelfMutation,
  useDelete: useDeleteShelfMutation,
  useAddItem: useAddShelfItemMutation,
  useUpdateItem: useUpdateShelfItemMutation,
  useRemoveItem: useRemoveShelfItemMutation,
};
