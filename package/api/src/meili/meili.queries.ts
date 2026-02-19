/**
 * React Query configurations for Meilisearch book queries
 */

import {queryOptions} from '@tanstack/react-query';
import {
  mapReadlistSearchResultToReadlistListResponse,
  meiliBookApi,
  meiliReadlistApi,
  meiliUnitApi,
  meiliFeedbackApi,
} from './meili.api';
import {type BookFilters} from '../book/book.types';
import type {
  UnitListResponse,
  FeedbackListResponse,
  FeedbackType,
} from '@package/contract';
import {UnitType} from '@package/contract';
import {hashFn} from '../utils/hash';
import {mapUnitListToReviewListResponse} from './mapper';

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

type buildMeiliUnitQueryProps = {
  kind: undefined | keyof typeof UnitType;
  start: number;
  targetUnitId: string | undefined;
  keyword: string;
  limit: number;
  mapFn: (unitResp: UnitListResponse) => any;
  options?: {
    enabled?: boolean;
    /**
     * Optional user filter – when provided, only units created by this user
     * will be returned. This maps to Meilisearch `userId` filter.
     */
    userId?: string;
  };
};

export const buildMeiliUnitQuery = ({
  kind,
  start,
  targetUnitId,
  keyword,
  limit,
  mapFn,
  options,
}: buildMeiliUnitQueryProps) => {
  const type = kind;
  const filters = {
    type,
    start,
    limit,
    q: keyword || undefined,
    ...(targetUnitId ? {targetUnitId} : {}),
    ...(options?.userId ? {userId: options.userId} : {}),
  };

  return {
    queryKey: [
      'meili-units',
      kind,
      targetUnitId ?? null,
      start,
      limit,
      keyword,
      options?.userId ?? null,
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

type FeedbackExtraFilterOptions = {
  /** Filter feedbacks created by a specific user. */
  userId?: string;
  /** Filter by feedback type (BUG / FEATURE / REPORT / OTHER). */
  type?: FeedbackType;
  /** Filter by resolved status. */
  resolved?: boolean;
};

export const buildMeiliFeedbackQuery = (
  offset: number,
  limit: number,
  keyword: string,
  options?: FeedbackExtraFilterOptions,
) => {
  const filters = {
    offset,
    limit,
    q: keyword || undefined,
    ...(options?.userId ? {userId: options.userId} : {}),
    ...(options?.type ? {type: options.type} : {}),
    ...(typeof options?.resolved === 'boolean'
      ? {resolved: options.resolved}
      : {}),
  } as const;

  return {
    queryKey: [
      'meili-feedbacks',
      offset,
      limit,
      keyword,
      options?.userId ?? null,
      options?.type ?? null,
      typeof options?.resolved === 'boolean' ? options.resolved : null,
    ],
    queryFn: async (): Promise<FeedbackListResponse> => {
      const searchResult = await meiliFeedbackApi.feedbackSearch(filters);
      return {
        items: searchResult.feedbacks as any[],
        offset,
        totalItems: searchResult.total,
      };
    },
    staleTime: 1000 * 60 * 5,
  } as const;
};

type ReadlistExtraFilterOptions = {
  /** Filter readlists created by a specific user. */
  userId?: string;
  /**
   * Filter readlists that contain the given book unit.
   * Maps to backend `hasBookUnitId`.
   */
  bookId?: string;
  /**
   * Filter readlists that contain the given review unit.
   * Maps to backend `hasReviewUnitId`.
   */
  reviewId?: string;
};

export const buildMeiliReadlistQuery = (
  startOffset: number,
  EXTERNAL_PAGE_SIZE: number,
  keyword: string,
  tags: string[],
  options?: ReadlistExtraFilterOptions,
) => {
  const filters = {
    start: startOffset,
    limit: EXTERNAL_PAGE_SIZE,
    q: keyword || undefined,
    tags: tags?.join(',') || undefined,
    ...(options?.userId ? {userId: options.userId} : {}),
    ...(options?.bookId ? {hasBookUnitId: options.bookId} : {}),
    ...(options?.reviewId ? {hasReviewUnitId: options.reviewId} : {}),
  } as const;

  return {
    queryKey: [
      'meili-readlists',
      startOffset,
      EXTERNAL_PAGE_SIZE,
      keyword,
      tags?.join(','),
      options?.userId ?? null,
      options?.bookId ?? null,
      options?.reviewId ?? null,
    ],
    queryFn: async () => {
      const searchResult = await meiliReadlistApi.readlistSearch(filters);
      return mapReadlistSearchResultToReadlistListResponse(searchResult);
    },
    staleTime: 1000 * 60 * 5,
  } as const;
};

type ReviewExtraFilterOptions = {
  /** Filter reviews created by a specific user. */
  userId?: string;
  /** Filter by book ID. */
  bookId?: string;
  /** Filter by keyword. */
  keyword?: string;
  /** Filter by tags. */
  tags?: string[];
  /** Filter by rating. */
  ratingMin?: number;
  /** Filter by rating. */
  ratingMax?: number;
  /** Filter by sort. */
  sort?: string;
};

export const buildMeiliReviewQuery = (
  startOffset: number,
  limit: number,
  options?: ReviewExtraFilterOptions,
) => {
  return buildMeiliUnitQuery({
    kind: UnitType.REVIEW,
    start: startOffset,
    targetUnitId: undefined,
    keyword: options?.keyword || '',
    limit,
    mapFn: mapUnitListToReviewListResponse,
    options,
  });
};
