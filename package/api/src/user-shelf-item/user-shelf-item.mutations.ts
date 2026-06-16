import type {
  PatchUserShelfItemMetadataInput,
  UserShelfItemMetadataDTO,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { userShelfItemApi } from "./user-shelf-item.api";
import { userShelfItemKeys } from "./user-shelf-item.keys";

export function usePatchUserShelfItemMutation(
  options?: Omit<
    UseMutationOptions<
      UserShelfItemMetadataDTO | null,
      Error,
      PatchUserShelfItemMetadataInput
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, ...input }) =>
      userShelfItemApi.patchForUnit(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(userShelfItemKeys.unit(variables.unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const userShelfItemMutations = {
  usePatch: usePatchUserShelfItemMutation,
};
