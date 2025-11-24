/**
 * React Query configurations for Meilisearch book queries
 */

import {queryOptions} from '@tanstack/react-query';
import type {BookQueryOptions} from '@package/contract';
import {meiliBookApi} from './meili.api';

export const meiliBookSearchQuery = (options: BookQueryOptions) =>
  queryOptions({
    queryKey: ['meili', 'books', options],
    queryFn: () => meiliBookApi.search(options),
    // Let caller control when to trigger by constructing options appropriately
    staleTime: 1000 * 60 * 2,
  });

export const meiliQueries = {
  booksSearch: meiliBookSearchQuery,
};


