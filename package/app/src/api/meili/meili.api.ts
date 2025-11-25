/**
 * Meilisearch Book & Unit API client
 *
 * Frontend wrapper around the backend Meili search endpoints.
 */

import type {
  BookListResponse,
  ReadlistDTO,
  ReadlistListResponse,
  ReadlistMetadata,
  UnitListResponse,
  ReviewDTO,
  ReviewListResponse,
} from '@package/contract';
import {buildQueryString} from '../utils/buildQuery';
import {apiFetch} from '../react-query/http';
import type {BookFilters} from '../book/book.types';
import type {UnitFilters} from '../unit/unit.types';

export const meiliBookApi = {
  /**
   * Search books via backend Meilisearch controller.
   *
   * The backend expects a `BookQueryOptions` object encoded in the query string.
   */
  bookSearch: async (filters?: BookFilters): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(
      `/meili/books/search${buildQueryString(filters)}`,
    );
  },
};

export const meiliUnitApi = {
  unitSearch: async (filters?: UnitFilters): Promise<UnitListResponse> => {
    return apiFetch<UnitListResponse>(
      `/meili/units/search${buildQueryString(filters)}`,
    );
  },
};

/**
 * Map a single Unit (from Meili unit index) into a ReviewDTO.
 *
 * - unit.id / unit.unitId -> ReviewDTO.unitId
 * - unit.targetUnitId     -> ReviewDTO.bookId
 * - unit.title/content    -> ReviewDTO.title/content
 * - unit.metadata.rating  -> ReviewDTO.rating
 * - unit.createdAt        -> ReviewDTO.created_at
 * - unit.user             -> ReviewDTO.user
 * - unit.reactionSummaries-> ReviewDTO.reactionSummaries
 */
export function mapUnitToReviewDTO(unit: any): ReviewDTO {
  return {
    unitId: unit.unitId ?? unit.id,
    bookId: unit.targetUnitId,
    title: unit.title,
    content: unit.content ?? '',
    rating: unit.metadata?.rating,
    created_at: unit.createdAt,
    user: unit.user,
    reactionSummaries: unit.reactionSummaries,
  };
}

/**
 * Convert a Meili /meili/units/search response into a ReviewListResponse
 * compatible with the existing review API.
 */
export function mapUnitListToReviewListResponse(
  unitResp: UnitListResponse,
): ReviewListResponse {
  const reviews: ReviewDTO[] =
    (unitResp.units as any[] | undefined)?.map(mapUnitToReviewDTO) ?? [];

  return {
    reviews,
    total: unitResp.total,
  };
}

/**
 * Map a single READLIST Unit (from Meili unit index) into a ReadlistDTO.
 *
 * - unit.id              -> ReadlistDTO.id
 * - unit.title/content   -> ReadlistDTO.title/content
 * - metadata.coverUrl    -> ReadlistDTO.coverUrl
 * - unit.user            -> ReadlistDTO.creator
 * - unit.reactionSummaries -> ReadlistDTO.reactionSummaries
 * - metadata.items       -> ReadlistDTO.books / ReadlistDTO.reviews (counts & unit links)
 */
export function mapUnitToReadlistDTO(unit: any): ReadlistDTO {
  const metadata = (unit.metadata ?? {}) as ReadlistMetadata | any;
  const items: {bookUnitId?: string; reviewUnitId?: string}[] = Array.isArray(
    metadata.items,
  )
    ? metadata.items
    : [];

  const books =
    items
      .filter(item => !!item.bookUnitId)
      .map(item => ({
        unitId: item.bookUnitId as string,
        title: '',
        coverUrl: undefined,
        author: undefined,
      })) ?? [];

  const reviews =
    items
      .filter(item => !!item.reviewUnitId)
      .map(item => ({
        unitId: item.reviewUnitId as string,
        title: undefined,
        content: undefined,
        targetUnitId: undefined,
      })) ?? [];

  const order: string[] | undefined =
    (metadata as any).order ??
    items
      .map(item => item.bookUnitId || item.reviewUnitId)
      .filter((id): id is string => !!id);

  return {
    id: unit.id,
    title: unit.title ?? '',
    content: unit.content ?? '',
    coverUrl: metadata.coverUrl,
    creator: unit.user,
    reactionSummaries: unit.reactionSummaries,
    books,
    reviews,
    order,
  };
}

/**
 * Convert a Meili /meili/units/search response into a ReadlistListResponse
 * compatible with the existing /readlists API.
 */
export function mapUnitListToReadlistListResponse(
  unitResp: UnitListResponse,
): ReadlistListResponse {
  const readlists: ReadlistDTO[] =
    (unitResp.units as any[] | undefined)?.map(mapUnitToReadlistDTO) ?? [];

  return {
    readlists,
    total: unitResp.total,
  };
}
