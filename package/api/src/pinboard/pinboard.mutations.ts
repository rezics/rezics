import type { PinboardOkResponse } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { realmKeys } from "../realm/realm.keys";
import { pinboardApi } from "./pinboard.api";
import { pinboardKeys } from "./pinboard.keys";

function invalidatePinboard(
  queryClient: ReturnType<typeof useQueryClient>,
  realmId: string,
  key: string,
) {
  queryClient.invalidateQueries({ queryKey: pinboardKeys.list(realmId, key) });
  queryClient.invalidateQueries({ queryKey: pinboardKeys.admin(realmId, key) });
  queryClient.invalidateQueries({ queryKey: realmKeys.detail(realmId) });
}

export function useAppendPinboardMutation(
  options?: Omit<
    UseMutationOptions<
      PinboardOkResponse,
      Error,
      { realmId: string; key: string; unitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ realmId, key, unitId }) =>
      pinboardApi.append(realmId, key, unitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidatePinboard(queryClient, variables.realmId, variables.key);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useReorderPinboardMutation(
  options?: Omit<
    UseMutationOptions<
      PinboardOkResponse,
      Error,
      { realmId: string; key: string; unitIds: string[] }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ realmId, key, unitIds }) =>
      pinboardApi.reorder(realmId, key, unitIds),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidatePinboard(queryClient, variables.realmId, variables.key);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRemovePinboardMutation(
  options?: Omit<
    UseMutationOptions<
      PinboardOkResponse,
      Error,
      { realmId: string; key: string; unitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ realmId, key, unitId }) =>
      pinboardApi.remove(realmId, key, unitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidatePinboard(queryClient, variables.realmId, variables.key);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
