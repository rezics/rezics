import type {
  CreateEntityInput,
  EditorialPatchSubmission,
  EntityDTO,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { entityApi } from "./entity.api";
import { entityKeys } from "./entity.keys";

const entityInvalidates = [entityKeys.all()];

export function useCreateEntity(
  options?: Omit<
    UseMutationOptions<EntityDTO, Error, CreateEntityInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEntityInput) => entityApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(entityKeys.detail(data.unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: entityInvalidates },
  });
}

export function useUpdateEntity(
  options?: Omit<
    UseMutationOptions<
      EntityDTO,
      Error,
      { unitId: string; input: EditorialPatchSubmission }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, input }) => entityApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(entityKeys.detail(variables.unitId), data);
      if (data.slug) {
        queryClient.setQueryData(entityKeys.bySlug(data.slug), data);
      }
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: entityInvalidates },
  });
}

export function useDeleteEntity(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (unitId: string) => entityApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: entityKeys.detail(unitId) });
      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
    meta: { invalidates: entityInvalidates },
  });
}

export const entityMutations = {
  useCreate: useCreateEntity,
  useUpdate: useUpdateEntity,
  useDelete: useDeleteEntity,
};
