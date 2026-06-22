import type { PinboardOkResponse } from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { realmKeys } from "../realm/realm.keys";
import { pinboardApi } from "./pinboard.api";
import { pinboardKeys } from "./pinboard.keys";

// ponytail: root prefixes; per-realm/key granularity if perf matters
const invalidates = [pinboardKeys.all(), realmKeys.all()];

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
  return useMutation({
    mutationFn: ({ realmId, key, unitId }) =>
      pinboardApi.append(realmId, key, unitId),
    ...options,
    meta: { invalidates },
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
  return useMutation({
    mutationFn: ({ realmId, key, unitIds }) =>
      pinboardApi.reorder(realmId, key, unitIds),
    ...options,
    meta: { invalidates },
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
  return useMutation({
    mutationFn: ({ realmId, key, unitId }) =>
      pinboardApi.remove(realmId, key, unitId),
    ...options,
    meta: { invalidates },
  });
}
