/**
 * Book API client functions
 * Direct API communication layer
 */

import type {
  BookListResponse,
  BookResponse,
  ChapterIndexResponse,
  CreateBookInput,
  ScoreAggregateDTO,
  UpdateBookInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { BookFilters } from "./book.types";

/**
 * Book API methods
 */
export const bookApi = {
  /**
   * List books with optional filters
   * Supports: q, rating, language, tagUnitIds, personId, organizationId,
   * userId, isbn13, workUnitId, visibility, status, sort, start, cursor, limit
   */
  list: async (filters?: BookFilters): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(`/book/list${buildQueryString(filters)}`);
  },

  /**
   * Get single book by unitId
   */
  get: async (unitId: string): Promise<BookResponse> => {
    return apiFetch<BookResponse>(`/book/${unitId}`);
  },

  /**
   * Get rating by book unitId
   */
  getRating: async (bookUnitId: string): Promise<ScoreAggregateDTO[]> => {
    return apiFetch<ScoreAggregateDTO[]>(`/book/${bookUnitId}/rating`);
  },

  /**
   * Get chapterIndex by bookUnitId
   */
  getChapterIndex: async (
    bookUnitId: string,
  ): Promise<ChapterIndexResponse> => {
    return apiFetch<ChapterIndexResponse>(`/book/${bookUnitId}/chapterIndex`);
  },

  /**
   * Update chapterIndex by bookUnitId
   */
  updateChapterIndex: async (
    bookUnitId: string,
    chaptersIndex: any,
  ): Promise<ChapterIndexResponse> => {
    return apiFetch<ChapterIndexResponse>(`/book/${bookUnitId}/chapterIndex`, {
      method: "PUT",
      body: JSON.stringify(chaptersIndex),
    });
  },

  /**
   * Search books by query and filters
   */
  search: async (
    query: string,
    filters?: BookFilters,
  ): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(
      `/book/list${buildQueryString({ q: query, ...filters })}`,
    );
  },

  /**
   * Get books by user ID
   */
  getByUserId: async (
    userId: string,
    filters?: BookFilters,
  ): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(
      `/book/list${buildQueryString({ userId, ...filters })}`,
    );
  },

  /**
   * Get books by entity ID (attribution credit)
   */
  getByEntityId: async (
    entityId: string,
    filters?: BookFilters,
  ): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(
      `/book/list${buildQueryString({ entityId, ...filters })}`,
    );
  },

  /**
   * Get book by ISBN-13
   */
  getByIsbn: async (isbn13: string): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(
      `/book/list${buildQueryString({ isbn13 })}`,
    );
  },

  /**
   * Get books by tag unit IDs (comma-separated)
   */
  getByTagUnitIds: async (
    tagUnitIds: string,
    filters?: BookFilters,
  ): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(
      `/book/list${buildQueryString({ tagUnitIds, ...filters })}`,
    );
  },

  /**
   * Create new book
   */
  create: async (input: CreateBookInput): Promise<BookResponse> => {
    return apiFetch<BookResponse>("/book", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Update existing book
   */
  update: async (
    unitId: string,
    input: UpdateBookInput,
  ): Promise<BookResponse> => {
    return apiFetch<BookResponse>(`/book/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete book
   */
  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/book/${unitId}`, {
      method: "DELETE",
    });
  },
};
