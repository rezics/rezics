/**
 * React Query keys for Review queries
 */

import type {ReviewFilters} from './review.types';

export const reviewKeys = {
  /**
   * Base key for all review queries
   */
  all: () => ['reviews'] as const,

  /**
   * Keys for list queries
   */
  lists: () => [...reviewKeys.all(), 'list'] as const,
  list: (filters?: ReviewFilters) => [...reviewKeys.lists(), filters] as const,

  /**
   * Keys for detail queries
   */
  details: () => [...reviewKeys.all(), 'detail'] as const,
  detail: (id: string) => [...reviewKeys.details(), id] as const,

  /**
   * Keys for search queries
   */
  searches: () => [...reviewKeys.all(), 'search'] as const,
  search: (query: string, filters?: ReviewFilters) =>
    [...reviewKeys.searches(), {q: query, ...filters}] as const,

  /**
   * User-specific queries
   */
  byUser: (userId: string) => [...reviewKeys.all(), 'user', userId] as const,

  /**
   * Book-specific queries
   */
  byBook: (bookId: string) => [...reviewKeys.all(), 'book', bookId] as const,

  /**
   * Tag-specific queries
   */
  byTag: (tag: string) => [...reviewKeys.all(), 'tag', tag] as const,
} as const;
