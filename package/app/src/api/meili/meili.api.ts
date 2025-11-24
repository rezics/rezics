/**
 * Meilisearch Book & Unit API client
 *
 * Frontend wrapper around the backend Meili search endpoints.
 */

import type {
  BookListResponse,
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
