import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {
  BookDTO,
  ReadlistDTO,
  ReviewDTO,
  QuoteDTO,
  UnitListResponse,
} from '@rezics/contract';
import {
  meiliBookApi,
  mapUnitListToReadlistListResponse,
  mapUnitListToReviewListResponse,
} from '@rezics/api/meili/meili.api';
import {buildMeiliUnitQuery} from '@rezics/api/meili/meili.queries';
import {UnitType} from '@rezics/contract';

export type SimpleQueryState<T> = {
  items: T[];
  total?: number;
  isLoading: boolean;
  error: unknown;
};

export function useHomeBooks(limit = 12): SimpleQueryState<BookDTO> {
  const {data, isLoading, error} = useQuery({
    queryKey: [
      'home',
      'meili',
      'books',
      {
        limit,
      },
    ],
    queryFn: () =>
      meiliBookApi.bookSearch({
        limit,
        sort: {type: 'createdAt', order: 'desc'},
      } as any),
    staleTime: 1000 * 60,
  });

  const items = useMemo<BookDTO[]>(() => {
    // Meili book search returns a list compatible with BookListResponse
    // so we safely access `books`.
    return ((data as any)?.books ?? []) as BookDTO[];
  }, [data]);

  const total: number | undefined = (data as any)?.total;

  return {items, total, isLoading, error};
}

export function useHomeReadlists(limit = 6): SimpleQueryState<ReadlistDTO> {
  const {data, isLoading, error} = useQuery(
    buildMeiliUnitQuery({
      kind: UnitType.READLIST,
      start: 0,
      targetUnitId: undefined,
      keyword: '',
      limit,
      mapFn: (unitResp: UnitListResponse) =>
        mapUnitListToReadlistListResponse(unitResp),
    }),
  );

  const items = useMemo<ReadlistDTO[]>(() => data?.readlists ?? [], [data]);
  const total: number | undefined = data?.total;

  return {items, total, isLoading, error};
}

type QuoteListResponse = {
  quotes: QuoteDTO[];
  total?: number;
};

export function useHomeQuotes(limit = 6): SimpleQueryState<QuoteDTO> {
  const {data, isLoading, error} = useQuery(
    buildMeiliUnitQuery({
      kind: UnitType.QUOTE,
      start: 0,
      targetUnitId: undefined,
      keyword: '',
      limit,
      mapFn: (unitResp: UnitListResponse) =>
        ({
          quotes: (unitResp.units ?? []).map(unit => ({
            id: unit.id,
            text: (unit.content as string) ?? '',
            from: unit.title ?? undefined,
            bookId: unit.targetUnitId ?? undefined,
            created_at:
              typeof unit.createdAt === 'string'
                ? unit.createdAt
                : unit.createdAt?.toString(),
          })),
          total: unitResp.total,
        }) as QuoteListResponse,
    }),
  );

  const items = useMemo<QuoteDTO[]>(() => (data as any)?.quotes ?? [], [data]);
  const total: number | undefined = (data as any)?.total;

  return {items, total, isLoading, error};
}
