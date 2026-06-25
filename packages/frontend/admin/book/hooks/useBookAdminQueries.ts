import type {
  BookListQuery,
  BookListResponse,
  ContentSearchOptions,
  ContentSearchResult,
} from "@rezics/contract";
import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

type BookListKey = readonly [
  "eden",
  "book",
  "list",
  BookListQuery,
  string,
];

type ContentSearchKey = readonly [
  "eden",
  "meili",
  "content",
  "search",
  ContentSearchOptions,
];

function bookListKey(
  filters: BookListQuery,
  searchTerm: string,
): BookListKey {
  return ["eden", "book", "list", filters, searchTerm] as const;
}

function contentSearchKey(options: ContentSearchOptions): ContentSearchKey {
  return ["eden", "meili", "content", "search", options] as const;
}

async function fetchBookList(
  key: BookListKey,
): Promise<BookListResponse> {
  const [, , , filters] = key;
  const response = await apiClient.book.list.get({ query: filters });

  return unwrapEdenResponse(response);
}

async function fetchContentSearch(
  key: ContentSearchKey,
): Promise<ContentSearchResult> {
  const [, , , , options] = key;
  const response = await apiClient.meili.content.search.post(options);

  return unwrapEdenResponse(response);
}

export function useBookListQuery(
  filters: BookListQuery,
  searchTerm: string,
  enabled = true,
) {
  const query = useSWR<BookListResponse>(
    enabled ? bookListKey(filters, searchTerm) : null,
    fetchBookList,
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

export function useBookContentSearchQuery(
  options: ContentSearchOptions,
  enabled: boolean,
) {
  const query = useSWR<ContentSearchResult>(
    enabled ? contentSearchKey(options) : null,
    fetchContentSearch,
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
