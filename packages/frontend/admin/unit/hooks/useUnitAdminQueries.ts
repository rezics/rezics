import type {
  ContentSearchOptions,
  ContentSearchResult,
  UnitListQuery,
  UnitListResponse,
} from "@rezics/contract";
import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

type UnitListKey = readonly ["eden", "unit", "list", UnitListQuery];

type ContentSearchKey = readonly [
  "eden",
  "meili",
  "content",
  "search",
  ContentSearchOptions,
];

function unitListKey(query: UnitListQuery): UnitListKey {
  return ["eden", "unit", "list", query] as const;
}

function contentSearchKey(options: ContentSearchOptions): ContentSearchKey {
  return ["eden", "meili", "content", "search", options] as const;
}

async function fetchUnitList(
  key: UnitListKey,
): Promise<UnitListResponse> {
  const [, , , query] = key;
  const response = await apiClient.unit.list.get({ query });

  return unwrapEdenResponse(response);
}

async function fetchContentSearch(
  key: ContentSearchKey,
): Promise<ContentSearchResult> {
  const [, , , , options] = key;
  const response = await apiClient.meili.content.search.post(options);

  return unwrapEdenResponse(response);
}

export function useUnitListQuery(query: UnitListQuery, enabled: boolean) {
  const result = useSWR<UnitListResponse>(
    enabled ? unitListKey(query) : null,
    fetchUnitList,
    {
      dedupingInterval: 60_000,
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

export function useUnitContentSearchQuery(
  options: ContentSearchOptions,
  enabled: boolean,
) {
  const result = useSWR<ContentSearchResult>(
    enabled ? contentSearchKey(options) : null,
    fetchContentSearch,
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
