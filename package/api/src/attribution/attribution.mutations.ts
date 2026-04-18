import type {
  AttributionDTO,
  CreateEntityInput,
  EntityDTO,
  LinkAttributionInput,
  UpdateEntityInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { attributionApi } from "./attribution.api";
import { attributionKeys } from "./attribution.keys";

// ---- Entity mutations ----

export function useCreateEntityMutation(
  options?: Omit<
    UseMutationOptions<EntityDTO, Error, CreateEntityInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEntityInput) =>
      attributionApi.createEntity(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: attributionKeys.entityLists(),
      });
      queryClient.setQueryData(attributionKeys.entityDetail(data.unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateEntityMutation(
  options?: Omit<
    UseMutationOptions<
      EntityDTO,
      Error,
      { id: string; input: UpdateEntityInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => attributionApi.updateEntity(id, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        attributionKeys.entityDetail(variables.id),
        data,
      );
      queryClient.invalidateQueries({
        queryKey: attributionKeys.entityLists(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteEntityMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attributionApi.deleteEntity(id),
    ...options,
    onSuccess: (data, id, onMutateResult, context) => {
      queryClient.removeQueries({
        queryKey: attributionKeys.entityDetail(id),
      });
      queryClient.invalidateQueries({
        queryKey: attributionKeys.entityLists(),
      });
      options?.onSuccess?.(data, id, onMutateResult, context);
    },
  });
}

// ---- Attribution mutations ----

export function useLinkAttributionMutation(
  options?: Omit<
    UseMutationOptions<AttributionDTO, Error, LinkAttributionInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LinkAttributionInput) =>
      attributionApi.linkAttribution(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: attributionKeys.attributionsByUnit(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUnlinkAttributionMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { unitId: string; entityId: string; role: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, entityId, role }) =>
      attributionApi.unlinkAttribution(unitId, entityId, role),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: attributionKeys.attributionsByUnit(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const attributionMutations = {
  useCreateEntity: useCreateEntityMutation,
  useUpdateEntity: useUpdateEntityMutation,
  useDeleteEntity: useDeleteEntityMutation,
  useLinkAttribution: useLinkAttributionMutation,
  useUnlinkAttribution: useUnlinkAttributionMutation,
};
