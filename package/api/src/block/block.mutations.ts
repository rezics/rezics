import type { CreateBlock } from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { blockApi } from "./block.api";
import { blockKeys } from "./block.keys";

const invalidates = [blockKeys.list()];

export function useBlockUserMutation(
  options?: Omit<
    UseMutationOptions<{ success: boolean }, Error, CreateBlock>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: CreateBlock) => blockApi.add(input),
    ...options,
    meta: { invalidates },
  });
}

export function useUnblockUserMutation(
  options?: Omit<
    UseMutationOptions<{ success: boolean }, Error, string>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (userId: string) => blockApi.remove(userId),
    ...options,
    meta: { invalidates },
  });
}

export const blockMutations = {
  useBlock: useBlockUserMutation,
  useUnblock: useUnblockUserMutation,
};
