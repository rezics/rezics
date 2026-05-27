import type {
  ContentStructureItem,
  ContentStructureResponse,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { contentStructureApi } from "./content-structure.api";
import { contentStructureKeys } from "./content-structure.keys";

export function useUpdateContentStructureMutation(
  options?: Omit<
    UseMutationOptions<
      ContentStructureResponse,
      Error,
      { ownerUnitId: string; nodes: ContentStructureItem[] }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ownerUnitId, nodes }) =>
      contentStructureApi.update(ownerUnitId, nodes),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: contentStructureKeys.detail(variables.ownerUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const contentStructureMutations = {
  useUpdate: useUpdateContentStructureMutation,
};
