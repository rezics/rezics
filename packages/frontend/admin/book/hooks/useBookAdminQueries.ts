import type {
  BookListQuery,
  BookListResponse,
  ContentSearchOptions,
  ContentSearchResult,
} from "@rezics/contract";
import {
  createEdenFetcher,
  useAdminEdenQuery,
} from "@/admin/shared/eden-swr";
import { apiClient } from "@/lib/api-client";

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

const fetchBookList = createEdenFetcher<BookListResponse, BookListKey>((key) => {
  const [, , , filters] = key;
  return apiClient.book.list.get({ query: filters });
});

const fetchContentSearch = createEdenFetcher<
  ContentSearchResult,
  ContentSearchKey
>((key) => {
  const [, , , , options] = key;
  return apiClient.meili.content.search.post(options);
});

export function useBookListQuery(
  filters: BookListQuery,
  searchTerm: string,
  enabled = true,
) {
  return useAdminEdenQuery(
    enabled ? bookListKey(filters, searchTerm) : null,
    fetchBookList,
    {
      dedupingInterval: 60_000,
      keepPreviousData: true,
    },
  );
}

export function useBookContentSearchQuery(
  options: ContentSearchOptions,
  enabled: boolean,
) {
  return useAdminEdenQuery(
    enabled ? contentSearchKey(options) : null,
    fetchContentSearch,
    {
      dedupingInterval: 60_000,
      keepPreviousData: true,
    },
  );
}
