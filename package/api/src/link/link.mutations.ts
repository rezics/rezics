import type {
  CreateLinkInput,
  LinkDTO,
  UpdateLinkInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { linkApi } from "./link.api";
import { linkKeys } from "./link.keys";

const linkInvalidates = [linkKeys.all()];

export function useCreateLinkMutation(
  options?: Omit<
    UseMutationOptions<LinkDTO, Error, CreateLinkInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLinkInput) => linkApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(linkKeys.detail(data.unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: linkInvalidates },
  });
}

export function useUpdateLinkMutation(
  options?: Omit<
    UseMutationOptions<
      LinkDTO,
      Error,
      { unitId: string; input: UpdateLinkInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, input }) => linkApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(linkKeys.detail(variables.unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: linkInvalidates },
  });
}

export function useDeleteLinkMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (unitId: string) => linkApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: linkKeys.detail(unitId) });
      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
    meta: { invalidates: linkInvalidates },
  });
}

export const linkMutations = {
  useCreate: useCreateLinkMutation,
  useUpdate: useUpdateLinkMutation,
  useDelete: useDeleteLinkMutation,
};
