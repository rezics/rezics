import type { CreateBlock } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { blockApi } from "./block.api";
import { blockKeys } from "./block.keys";

export function useBlockUserMutation(
  options?: Omit<
    UseMutationOptions<{ success: boolean }, Error, CreateBlock>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBlock) => blockApi.add(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.invalidateQueries({ queryKey: blockKeys.list() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUnblockUserMutation(
  options?: Omit<
    UseMutationOptions<{ success: boolean }, Error, string>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => blockApi.remove(userId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.invalidateQueries({ queryKey: blockKeys.list() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const blockMutations = {
  useBlock: useBlockUserMutation,
  useUnblock: useUnblockUserMutation,
};
