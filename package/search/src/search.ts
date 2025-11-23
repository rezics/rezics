// meili.search.ts
import {bookIndex} from './meili_index';

export type BookSearchInput = {
  q?: string;
  page?: number;
  limit?: number;
  filters?: string;
  sort?: string[];
};

export async function searchBooks(input: BookSearchInput) {
  return bookIndex.search(input.q ?? '', {
    page: input.page ?? 1,
    hitsPerPage: input.limit ?? 20,
    filter: input.filters,
    sort: input.sort,
  });
}
