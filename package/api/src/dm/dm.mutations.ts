import type { DmBlockState, DmReadReceipt, DmSendBody } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { dmApi } from "./dm.api";
import { dmKeys } from "./dm.keys";

const dmInvalidates = [dmKeys.all()];

export function useSendDmMutation(
  options?: Omit<
    UseMutationOptions<{ success: true }, Error, DmSendBody>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: DmSendBody) => dmApi.send(input),
    meta: { invalidates: dmInvalidates },
    ...options,
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
  return useMutation({
    mutationFn: ({ conversationId, upToMessageId }) =>
      dmApi.markRead(conversationId, upToMessageId),
    meta: { invalidates: dmInvalidates },
    ...options,
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
    meta: { invalidates: dmInvalidates },
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(dmKeys.blockState(variables.peerId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const dmMutations = {
  useSend: useSendDmMutation,
  useMarkRead: useMarkDmReadMutation,
  useSetBlock: useSetDmBlockMutation,
};
