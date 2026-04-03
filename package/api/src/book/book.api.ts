/**
 * Book API client functions
 * Direct API communication layer
 */

import type {
  CreateBookInput,
  UpdateBookInput,
  BookListResponse,
  BookResponse,
  ChapterIndexResponse,
} from '@rezics/contract';
import type {BookFilters} from './book.types';
import {buildQueryString} from '../utils/buildQuery';

import {apiFetch} from '../react-query/http';

type Rating = {
  unitId: string;
  updatedAt: Date;
  domain: string;
  totalScore: number;
  totalCount: number;
};

/**
 * Book API methods
 */
export const bookApi = {
  /**
   * List books with optional filters
   */
  list: async (filters?: BookFilters): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(`/books${buildQueryString(filters)}`);
  },

  /**
   * Get single book by unitId
   */
  get: async (unitId: string): Promise<BookResponse> => {
    return apiFetch<BookResponse>(`/books/${unitId}`);
  },

  /**
   * Get rating by book unitId
   */
  getRating: async (bookUnitId: string): Promise<Rating> => {
    return apiFetch<Rating>(`/books/${bookUnitId}/rating`);
  },

  /**
   * Get chapterIndex by bookUnitId
   */
  getChapterIndex: async (
    bookUnitId: string,
  ): Promise<ChapterIndexResponse> => {
    return apiFetch<ChapterIndexResponse>(`/books/${bookUnitId}/chapterIndex`);
  },

  /**
   * Update chapterIndex by bookUnitId
   */
  updateChapterIndex: async (
    bookUnitId: string,
    chaptersIndex: any,
  ): Promise<ChapterIndexResponse> => {
    return apiFetch<ChapterIndexResponse>(`/books/${bookUnitId}/chapterIndex`, {
      method: 'PUT',
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
      `/books${buildQueryString({q: query, ...filters})}`,
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
      `/books${buildQueryString({userId, ...filters})}`,
    );
  },

  /**
   * Get books by author ID
   */
  getByAuthorId: async (
    authorId: string,
    filters?: BookFilters,
  ): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(
      `/books${buildQueryString({authorId, ...filters})}`,
    );
  },

  /**
   * Get book by ISBN
   */
  getByIsbn: async (isbn: string): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(`/books${buildQueryString({isbn})}`);
  },

  /**
   * Create new book
   */
  create: async (input: CreateBookInput): Promise<BookResponse> => {
    return apiFetch<BookResponse>('/books', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update existing book
   */
  update: async (
    postId: string,
    input: UpdateBookInput,
  ): Promise<BookResponse> => {
    return apiFetch<BookResponse>(`/books/${postId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete book
   */
  remove: async (postId: string): Promise<{message: string}> => {
    return apiFetch<{message: string}>(`/books/${postId}`, {
      method: 'DELETE',
    });
  },
};
