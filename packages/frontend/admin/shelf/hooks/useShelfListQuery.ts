import type { ShelfListQuery, ShelfListResponse } from "@rezics/contract";
import {
  createEdenFetcher,
  useAdminEdenQuery,
} from "@/admin/shared/eden-swr";
import { apiClient } from "@/lib/api-client";

type ShelfListKey = readonly ["eden", "shelf", "list", ShelfListQuery];

function shelfListKey(filters: ShelfListQuery): ShelfListKey {
  return ["eden", "shelf", "list", filters] as const;
}

const fetchShelfList = createEdenFetcher<ShelfListResponse, ShelfListKey>(
  (key) => {
    const [, , , filters] = key;
    return apiClient.shelf.list.get({ query: filters });
  },
);

export function useShelfListQuery(filters: ShelfListQuery) {
  return useAdminEdenQuery(shelfListKey(filters), fetchShelfList, {
    keepPreviousData: true,
  });
}
