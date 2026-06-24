import type { RealmExtra, RealmExtraOkResponse } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { realmKeys } from "./realm.keys";
import { realmExtraApi } from "./realm-extra.api";

function invalidateRealmExtra(
  queryClient: ReturnType<typeof useQueryClient>,
  realmId: string,
) {
  queryClient.invalidateQueries({ queryKey: realmKeys.detail(realmId) });
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
      invalidateRealmExtra(queryClient, variables.realmId);
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
      invalidateRealmExtra(queryClient, variables.realmId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const realmExtraMutations = {
  useSetValue: useSetRealmExtraValueMutation,
  useClearValue: useClearRealmExtraValueMutation,
};
