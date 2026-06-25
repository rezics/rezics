import type { EntityListQuery, EntityListResponse } from "@rezics/contract";
import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

type EntityListKey = readonly ["eden", "entity", "list", EntityListQuery];

function entityListKey(query: EntityListQuery): EntityListKey {
  return ["eden", "entity", "list", query] as const;
}

async function fetchEntityList(
  key: EntityListKey,
): Promise<EntityListResponse> {
  const [, , , query] = key;
  const response = await apiClient.entity.get({ query });

  return unwrapEdenResponse(response);
}

export function useEntityListQuery(query: EntityListQuery) {
  const result = useSWR<EntityListResponse>(
    entityListKey(query),
    fetchEntityList,
    {
      dedupingInterval: 120_000,
      keepPreviousData: true,
    },
  );

  return {
    data: result.data,
    error: result.error,
    isError: Boolean(result.error),
    isFetching: result.isValidating,
    isLoading: result.isLoading,
    refetch: () => {
      void result.mutate();
    },
  };
}
