import type { DmSendBody } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { dmApi } from "./dm.api";
import { dmKeys } from "./dm.keys";

export function useSendDmMutation(
  options?: Omit<
    UseMutationOptions<{ success: true }, Error, DmSendBody>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DmSendBody) => dmApi.send(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.invalidateQueries({ queryKey: dmKeys.conversations() });
      qc.invalidateQueries({ queryKey: dmKeys.all() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const useSendDm = useSendDmMutation;

export const dmMutations = {
  useSend: useSendDmMutation,
};
