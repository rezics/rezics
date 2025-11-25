/**
 * React Query configurations for Meilisearch book queries
 */

import {queryOptions} from '@tanstack/react-query';
import {meiliBookApi} from './meili.api';
import {type BookFilters} from '../book/book.types';
import {meiliUnitApi} from './meili.api';
import type {UnitListResponse, UnitType} from '@package/contract/src/unit';

export const meiliBookSearchQuery = (filters?: BookFilters) =>
  queryOptions({
    queryKey: ['meili', 'books', filters],
    queryFn: () => meiliBookApi.bookSearch(filters),
    // Let caller control when to trigger by constructing options appropriately
    staleTime: 1000 * 60 * 2,
  });

export const meiliQueries = {
  booksSearch: meiliBookSearchQuery,
};

export const buildMeiliUnitQuery = (
  kind: keyof typeof UnitType,
  start: number,
  targetUnitId: string,
  keyword: string,
  limit: number,
  mapFn: (unitResp: UnitListResponse) => any,
) => {
  const type = kind;
  const filters = {
    type,
    targetUnitId,
    start,
    limit,
    q: keyword || undefined,
  };

  return {
    queryKey: ['meili-units', kind, targetUnitId, start, keyword],
    queryFn: async () => {
      const unitResp = await meiliUnitApi.unitSearch(filters);
      return mapFn(unitResp);
    },
    enabled: !!targetUnitId,
    staleTime: 1000 * 60 * 5,
  } as const;
};
