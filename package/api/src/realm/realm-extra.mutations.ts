import type { RealmExtra, RealmExtraOkResponse } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { realmKeys } from "./realm.keys";
import { realmExtraApi } from "./realm-extra.api";
import { realmExtraKeys } from "./realm-extra.keys";

function invalidateLists(
  queryClient: ReturnType<typeof useQueryClient>,
  realmId: string,
  key: string,
) {
  queryClient.invalidateQueries({
    queryKey: realmExtraKeys.list(realmId, key),
  });
  queryClient.invalidateQueries({
    queryKey: realmExtraKeys.admin(realmId, key),
  });
  queryClient.invalidateQueries({ queryKey: realmKeys.detail(realmId) });
}

export function useAppendRealmExtraMutation(
  options?: Omit<
    UseMutationOptions<
      RealmExtraOkResponse,
      Error,
      { realmId: string; key: string; unitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ realmId, key, unitId }) =>
      realmExtraApi.append(realmId, key, unitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateLists(queryClient, variables.realmId, variables.key);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useReorderRealmExtraMutation(
  options?: Omit<
    UseMutationOptions<
      RealmExtraOkResponse,
      Error,
      { realmId: string; key: string; unitIds: string[] }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ realmId, key, unitIds }) =>
      realmExtraApi.reorder(realmId, key, unitIds),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateLists(queryClient, variables.realmId, variables.key);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRemoveRealmExtraMutation(
  options?: Omit<
    UseMutationOptions<
      RealmExtraOkResponse,
      Error,
      { realmId: string; key: string; unitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ realmId, key, unitId }) =>
      realmExtraApi.remove(realmId, key, unitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateLists(queryClient, variables.realmId, variables.key);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useSetRealmExtraValueMutation(
  options?: Omit<
    UseMutationOptions<
      RealmExtraOkResponse,
      Error,
      { realmId: string; key: string; value: RealmExtra[keyof RealmExtra] }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ realmId, key, value }) =>
      realmExtraApi.setValue(realmId, key, value),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateLists(queryClient, variables.realmId, variables.key);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useClearRealmExtraValueMutation(
  options?: Omit<
    UseMutationOptions<
      RealmExtraOkResponse,
      Error,
      { realmId: string; key: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ realmId, key }) => realmExtraApi.clearValue(realmId, key),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateLists(queryClient, variables.realmId, variables.key);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const realmExtraMutations = {
  useAppend: useAppendRealmExtraMutation,
  useReorder: useReorderRealmExtraMutation,
  useRemove: useRemoveRealmExtraMutation,
  useSetValue: useSetRealmExtraValueMutation,
  useClearValue: useClearRealmExtraValueMutation,
};
