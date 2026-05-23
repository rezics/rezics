/**
 * React Query mutations for Unit operations
 */

import type {
  CreateUnitInput,
  EditorialPatchSubmission,
  UnitResponse,
  UnitTranslationDTO,
  UpdateTranslationInput,
  UpdateUnitInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { unitApi } from "./unit.api";
import { unitKeys } from "./unit.keys";

/**
 * Mutation for creating a unit
 */
export function useCreateUnitMutation(
  options?: Omit<
    UseMutationOptions<UnitResponse, Error, CreateUnitInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUnitInput) => unitApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate and refetch unit lists
      queryClient.invalidateQueries({ queryKey: unitKeys.lists() });

      // Pre-populate the cache with the new unit
      if (data?.id) {
        queryClient.setQueryData(unitKeys.detail(data.id), data);
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
      { unitId: string; input: UpdateUnitInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }) => unitApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update the cache for this specific unit
      queryClient.setQueryData(unitKeys.detail(variables.unitId), data);

      // Invalidate lists to ensure they're refreshed
      queryClient.invalidateQueries({ queryKey: unitKeys.lists() });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a unit
 */
export function useDeleteUnitMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => unitApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: unitKeys.detail(unitId) });

      // Invalidate all lists
      queryClient.invalidateQueries({ queryKey: unitKeys.lists() });

      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

/**
 * Mutation for upserting a translation row on a unit
 */
export function useUpsertTranslationMutation(
  options?: Omit<
    UseMutationOptions<
      UnitTranslationDTO,
      Error,
      {
        unitId: string;
        language: string;
        input: UpdateTranslationInput | EditorialPatchSubmission;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, language, input }) =>
      unitApi.upsertTranslation(unitId, language, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: unitKeys.detail(variables.unitId),
      });
      queryClient.invalidateQueries({ queryKey: unitKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a translation row on a unit
 */
export function useDeleteTranslationMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { unitId: string; language: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, language }) =>
      unitApi.deleteTranslation(unitId, language),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: unitKeys.detail(variables.unitId),
      });
      queryClient.invalidateQueries({ queryKey: unitKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
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
  useUpsertTranslation: useUpsertTranslationMutation,
  useDeleteTranslation: useDeleteTranslationMutation,
};
