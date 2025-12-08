/**
 * Meilisearch Book & Unit API client
 *
 * Frontend wrapper around the backend Meili search endpoints.
 */

import type {
  BookListResponse,
  ReadlistListQuery,
  UnitListResponse,
  FeedbackListQuery,
} from '@package/contract';
import type {
  ReadlistSearchResult,
  FeedbackSearchResult,
} from '@package/contract';
import {buildQueryString} from '../utils/buildQuery';
import {apiFetch} from '../react-query/http';
import type {BookFilters} from '../book/book.types';
import type {UnitFilters} from '../unit/unit.types';

export * from './mapper';

export const meiliBookApi = {
  /**
   * Search books via backend Meilisearch controller.
   *
   * The backend expects a `BookQueryOptions` object encoded in the query string.
   */
  bookSearch: async (filters?: BookFilters): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(`/meili/books/search`, {
      method: 'POST',
      body: JSON.stringify(filters),
    });
  },
};

export const meiliReadlistApi = {
  /**
   * Search readlists via backend Meilisearch controller.
   *
   * The backend expects a `ReadlistListQuery` object encoded in the request body.
   */
  readlistSearch: async (
    filters?: ReadlistListQuery,
  ): Promise<ReadlistSearchResult> => {
    return apiFetch<ReadlistSearchResult>(`/meili/readlists/search`, {
      method: 'POST',
      body: JSON.stringify(filters),
    });
  },
};

export const meiliUnitApi = {
  unitSearch: async (filters?: UnitFilters): Promise<UnitListResponse> => {
    return apiFetch<UnitListResponse>(
      `/meili/units/search${buildQueryString(filters)}`,
    );
  },
};

export const meiliFeedbackApi = {
  /**
   * Search feedbacks via backend Meilisearch controller.
   *
   * The backend expects a `FeedbackListQuery` object encoded in the request body.
   */
  feedbackSearch: async (
    filters?: FeedbackListQuery,
  ): Promise<FeedbackSearchResult> => {
    return apiFetch<FeedbackSearchResult>(`/meili/feedbacks/search`, {
      method: 'POST',
      body: JSON.stringify(filters),
    });
  },
};
