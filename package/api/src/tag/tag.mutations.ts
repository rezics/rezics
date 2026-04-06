import type { CreateTagInput, UpdateTagInput } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { tagApi } from "./tag.api";
import { tagKeys } from "./tag.keys";

export function useCreateTagMutation(
  options?: Omit<UseMutationOptions<any, Error, CreateTagInput>, "mutationFn">,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTagInput) => tagApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
      // contract TagDetailDTO uses `id` field
      // pre-populate detail cache if available (TagDetailDTO uses `id`)
      queryClient.setQueryData(tagKeys.detail((data as any).id), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateTagMutation(
  options?: Omit<
    UseMutationOptions<any, Error, { unitId: string; input: UpdateTagInput }>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      unitId,
      input,
    }: {
      unitId: string;
      input: UpdateTagInput;
    }) => tagApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(tagKeys.detail(variables.unitId), data);
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteTagMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => tagApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: tagKeys.detail(unitId) });
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

export function useAttachTagMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { unitId: string; targetUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, targetUnitId }) =>
      tagApi.attach(unitId, targetUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: tagKeys.detail(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDetachTagMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { unitId: string; targetUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, targetUnitId }) =>
      tagApi.detach(unitId, targetUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: tagKeys.detail(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const tagMutations = {
  useCreate: useCreateTagMutation,
  useUpdate: useUpdateTagMutation,
  useDelete: useDeleteTagMutation,
  useAttach: useAttachTagMutation,
  useDetach: useDetachTagMutation,
};
