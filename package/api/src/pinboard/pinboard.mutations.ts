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
  placement: string,
) {
  queryClient.invalidateQueries({
    queryKey: pinboardKeys.list(realmId, placement),
  });
  queryClient.invalidateQueries({
    queryKey: pinboardKeys.admin(realmId, placement),
  });
  queryClient.invalidateQueries({ queryKey: realmKeys.detail(realmId) });
}

export function useAppendPinboardMutation(
  options?: Omit<
    UseMutationOptions<
      PinboardOkResponse,
      Error,
      { realmId: string; placement: string; unitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ realmId, placement, unitId }) =>
      pinboardApi.append(realmId, placement, unitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidatePinboard(queryClient, variables.realmId, variables.placement);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useReorderPinboardMutation(
  options?: Omit<
    UseMutationOptions<
      PinboardOkResponse,
      Error,
      { realmId: string; placement: string; unitIds: string[] }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ realmId, placement, unitIds }) =>
      pinboardApi.reorder(realmId, placement, unitIds),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidatePinboard(queryClient, variables.realmId, variables.placement);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRemovePinboardMutation(
  options?: Omit<
    UseMutationOptions<
      PinboardOkResponse,
      Error,
      { realmId: string; placement: string; unitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ realmId, placement, unitId }) =>
      pinboardApi.remove(realmId, placement, unitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidatePinboard(queryClient, variables.realmId, variables.placement);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
