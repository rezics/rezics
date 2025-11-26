/**
 * React Query configurations for Meilisearch book queries
 */

import {queryOptions} from '@tanstack/react-query';
import {
  mapUnitListToReadlistListResponse,
  meiliBookApi,
  meiliUnitApi,
} from './meili.api';
import {type BookFilters} from '../book/book.types';
import type {UnitListResponse, UnitType} from '@package/contract/src/unit';
import {hashFn} from '../utils/hash';

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
  kind: undefined | keyof typeof UnitType,
  start: number,
  targetUnitId: string | undefined,
  keyword: string,
  limit: number,
  mapFn: (unitResp: UnitListResponse) => any,
  options?: {
    enabled?: boolean;
  },
) => {
  const type = kind;
  const filters = {
    type,
    start,
    limit,
    q: keyword || undefined,
    ...(targetUnitId ? {targetUnitId} : {}),
  };

  return {
    queryKey: [
      'meili-units',
      kind,
      targetUnitId ?? null,
      start,
      keyword,
      hashFn(mapFn),
    ],
    queryFn: async () => {
      const unitResp = await meiliUnitApi.unitSearch(filters);
      return mapFn(unitResp);
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5,
  } as const;
};

export const buildMeiliReadlistQuery = (
  startOffset: number,
  EXTERNAL_PAGE_SIZE: number,
  keyword: string,
  tags: string[],
) => {
  const filters = {
    type: 'READLIST',
    start: startOffset,
    limit: EXTERNAL_PAGE_SIZE,
    q: keyword || undefined,
    tags: tags?.join(',') || undefined,
  } as const;

  return {
    queryKey: ['meili-readlists', startOffset, keyword, tags?.join(',')],
    queryFn: async () => {
      const unitResp = await meiliUnitApi.unitSearch(filters);
      return mapUnitListToReadlistListResponse(unitResp);
    },
    staleTime: 1000 * 60 * 5,
  } as const;
};
