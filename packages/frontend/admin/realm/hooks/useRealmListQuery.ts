import type { RealmListQuery, RealmListResponse } from "@rezics/contract";
import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

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

async function fetchRealmList(
  key: RealmListKey,
): Promise<RealmListResponse> {
  const [, , , filters] = key;
  const response = await apiClient.realm.list.get({ query: filters });

  return unwrapEdenResponse(response);
}

export function useRealmListQuery(
  filters: RealmListQuery,
  searchTerm: string,
) {
  const query = useSWR<RealmListResponse>(
    realmListKey(filters, searchTerm),
    fetchRealmList,
    {
      dedupingInterval: 60_000,
      keepPreviousData: true,
    },
  );

  return {
    data: query.data,
    error: query.error,
    isError: Boolean(query.error),
    isFetching: query.isValidating,
    isLoading: query.isLoading,
    refetch: () => {
      void query.mutate();
    },
  };
}
