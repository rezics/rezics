import type { DmBlockState, DmReadReceipt, DmSendBody } from "@rezics/contract";
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

export function useMarkDmReadMutation(
  options?: Omit<
    UseMutationOptions<
      DmReadReceipt,
      Error,
      { conversationId: string; upToMessageId: string }
    >,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, upToMessageId }) =>
      dmApi.markRead(conversationId, upToMessageId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.invalidateQueries({ queryKey: dmKeys.conversations() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useSetDmBlockMutation(
  options?: Omit<
    UseMutationOptions<
      DmBlockState,
      Error,
      { peerId: string; blocked: boolean }
    >,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ peerId, blocked }) => dmApi.setBlock(peerId, blocked),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(dmKeys.blockState(variables.peerId), data);
      qc.invalidateQueries({ queryKey: dmKeys.conversations() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const dmMutations = {
  useSend: useSendDmMutation,
  useMarkRead: useMarkDmReadMutation,
  useSetBlock: useSetDmBlockMutation,
};
