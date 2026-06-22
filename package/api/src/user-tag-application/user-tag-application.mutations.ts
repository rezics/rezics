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

const utaInvalidates = [userTagApplicationKeys.all()];

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
    meta: { invalidates: utaInvalidates },
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
  return useMutation({
    mutationFn: ({ unitId, tagUnitId, ...input }) =>
      userTagApplicationApi.reorder(unitId, tagUnitId, input),
    meta: { invalidates: utaInvalidates },
    ...options,
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
  return useMutation({
    mutationFn: ({ unitId, tagUnitId }) =>
      userTagApplicationApi.deleteOne(unitId, tagUnitId),
    meta: { invalidates: utaInvalidates },
    ...options,
  });
}

export const userTagApplicationMutations = {
  useSet: useSetUserTagApplicationsMutation,
  useReorder: useReorderUserTagApplicationMutation,
  useDelete: useDeleteUserTagApplicationMutation,
};
