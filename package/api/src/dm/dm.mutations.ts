import type { DmSendBody } from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { dmApi } from "./dm.api";

export function useSendDmMutation(
  options?: Omit<
    UseMutationOptions<{ success: true }, Error, DmSendBody>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: DmSendBody) => dmApi.send(input),
    ...options,
  });
}

export const dmMutations = {
  useSend: useSendDmMutation,
};
