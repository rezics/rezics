// meili.search.ts
// Legacy low-level search helper kept for backward compatibility.
// Prefer using the high-level APIs exported from `src/index.ts`.

import {bookIndex} from './meili_index';

export type BookSearchInput = {
  q?: string;
  page?: number;
  limit?: number;
  filters?: string | string[];
  sort?: string[];
};

/**
 * Low-level wrapper around `bookIndex.search`.
 *
 * @deprecated Prefer using `searchBooks` from `src/index.ts`, which
 * accepts a typed `BookQueryOptions` object from `@package/contract`.
 */
export async function searchBooks(input: BookSearchInput) {
  return bookIndex.search(input.q ?? '', {
    page: input.page ?? 1,
    hitsPerPage: input.limit ?? 20,
    filter: input.filters,
    sort: input.sort,
  });
}

