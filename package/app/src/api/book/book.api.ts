/**
 * Book API client functions
 * Direct API communication layer
 */

import type {
  CreateBookInput,
  UpdateBookInput,
  BookListResponse,
  BookResponse,
} from '@package/contract';
import type {BookFilters} from './book.types';

/**
 * Build query string from filters
 */
function buildQueryString(filters?: BookFilters): string {
  if (!filters) return '';

  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Base API URL - should be configured via environment
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options?: globalThis.RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: `HTTP error! status: ${response.status}`,
    }));
    throw new Error(error.message || 'API request failed');
  }

  return response.json();
}

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
   * Get single book by postId
   */
  get: async (postId: string): Promise<BookResponse> => {
    return apiFetch<BookResponse>(`/books/${postId}`);
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
