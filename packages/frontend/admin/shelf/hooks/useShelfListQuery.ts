import type { ShelfListQuery, ShelfListResponse } from "@rezics/contract";
import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

const shelfClient = apiClient as any;

type ShelfListKey = readonly ["eden", "shelf", "list", ShelfListQuery];

function shelfListKey(filters: ShelfListQuery): ShelfListKey {
  return ["eden", "shelf", "list", filters] as const;
}

async function fetchShelfList(
  key: ShelfListKey,
): Promise<ShelfListResponse> {
  const [, , , filters] = key;
  const response = await shelfClient.shelf.list.get({ query: filters });

  return unwrapEdenResponse<ShelfListResponse>(response);
}

export function useShelfListQuery(filters: ShelfListQuery) {
  const query = useSWR<ShelfListResponse>(shelfListKey(filters), fetchShelfList, {
    keepPreviousData: true,
  });

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
