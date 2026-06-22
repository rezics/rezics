import type { RealmExtra, RealmExtraOkResponse } from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { realmKeys } from "./realm.keys";
import { realmExtraApi } from "./realm-extra.api";

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
  return useMutation({
    ...options,
    mutationFn: ({ realmId, key, value }) =>
      realmExtraApi.setValue(realmId, key, value),
    // ponytail: root prefix; covers realmKeys.detail(realmId) for any realmId
    meta: { invalidates: [realmKeys.details()] },
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
  return useMutation({
    ...options,
    mutationFn: ({ realmId, key }) => realmExtraApi.clearValue(realmId, key),
    // ponytail: root prefix; covers realmKeys.detail(realmId) for any realmId
    meta: { invalidates: [realmKeys.details()] },
  });
}

export const realmExtraMutations = {
  useSetValue: useSetRealmExtraValueMutation,
  useClearValue: useClearRealmExtraValueMutation,
};
