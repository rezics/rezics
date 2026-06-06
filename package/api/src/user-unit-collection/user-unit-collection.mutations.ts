import type {
  PatchUserUnitCollectionInput,
  UserUnitCollectionDTO,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { userUnitCollectionApi } from "./user-unit-collection.api";
import { userUnitCollectionKeys } from "./user-unit-collection.keys";

export function usePatchUserUnitCollectionMutation(
  options?: Omit<
    UseMutationOptions<
      UserUnitCollectionDTO | null,
      Error,
      PatchUserUnitCollectionInput
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, ...input }) =>
      userUnitCollectionApi.patchForUnit(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        userUnitCollectionKeys.unit(variables.unitId),
        data,
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const userUnitCollectionMutations = {
  usePatch: usePatchUserUnitCollectionMutation,
};
