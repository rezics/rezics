import type {
  ReorderUserTagApplicationInput,
  SetUserTagApplicationsInput,
  UserTagApplicationDTO,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { userTagApplicationApi } from "./user-tag-application.api";
import { userTagApplicationKeys } from "./user-tag-application.keys";

export function useSetUserTagApplicationsMutation(
  options?: Omit<
    UseMutationOptions<
      UserTagApplicationDTO[],
      Error,
      SetUserTagApplicationsInput
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, ...input }) =>
      userTagApplicationApi.setForUnit(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        userTagApplicationKeys.unit(variables.unitId),
        data,
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useReorderUserTagApplicationMutation(
  options?: Omit<
    UseMutationOptions<
      UserTagApplicationDTO,
      Error,
      ReorderUserTagApplicationInput
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, tagUnitId, ...input }) =>
      userTagApplicationApi.reorder(unitId, tagUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: userTagApplicationKeys.unit(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteUserTagApplicationMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { unitId: string; tagUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, tagUnitId }) =>
      userTagApplicationApi.deleteOne(unitId, tagUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: userTagApplicationKeys.unit(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const userTagApplicationMutations = {
  useSet: useSetUserTagApplicationsMutation,
  useReorder: useReorderUserTagApplicationMutation,
  useDelete: useDeleteUserTagApplicationMutation,
};
