import type { RealmListQuery, RealmListResponse } from "@rezics/contract";
import {
  createEdenFetcher,
  useAdminEdenQuery,
} from "@/admin/shared/eden-swr";
import { apiClient } from "@/lib/api-client";

type RealmListKey = readonly [
  "eden",
  "realm",
  "list",
  RealmListQuery,
  string,
];

function realmListKey(
  filters: RealmListQuery,
  searchTerm: string,
): RealmListKey {
  return ["eden", "realm", "list", filters, searchTerm] as const;
}

const fetchRealmList = createEdenFetcher<RealmListResponse, RealmListKey>(
  (key) => {
    const [, , , filters] = key;
    return apiClient.realm.list.get({ query: filters });
  },
);

export function useRealmListQuery(
  filters: RealmListQuery,
  searchTerm: string,
) {
  return useAdminEdenQuery(realmListKey(filters, searchTerm), fetchRealmList, {
    dedupingInterval: 60_000,
    keepPreviousData: true,
  });
}
