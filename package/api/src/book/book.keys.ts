/**
 * React Query keys for Book queries
 * Following TanStack Query best practices for key management
 */

import type { BookFilters } from "./book.types";

export const bookKeys = {
  /**
   * Base key for all book queries
   */
  all: () => ["books"] as const,

  /**
   * Keys for list queries
   */
  lists: () => [...bookKeys.all(), "list"] as const,
  list: (filters?: BookFilters) => [...bookKeys.lists(), filters] as const,

  /**
   * Keys for detail queries
   */
  details: () => [...bookKeys.all(), "detail"] as const,
  detail: (postId: string) => [...bookKeys.details(), postId] as const,
  rating: (bookUnitId: string) =>
    [...bookKeys.all(), "rating", bookUnitId] as const,
  chapterIndex: (bookUnitId: string) =>
    [...bookKeys.all(), "chapterIndex", bookUnitId] as const,

  /**
   * Keys for search queries
   */
  searches: () => [...bookKeys.all(), "search"] as const,
  search: (query: string, filters?: BookFilters) =>
    [...bookKeys.searches(), { q: query, ...filters }] as const,

  /**
   * Keys for user-specific queries
   */
  byUser: (userId: string) => [...bookKeys.all(), "user", userId] as const,

  /**
   * Keys for author-specific queries
   */
  byAuthor: (authorId: string) =>
    [...bookKeys.all(), "author", authorId] as const,

  /**
   * Keys for ISBN lookup
   */
  byIsbn: (isbn: string) => [...bookKeys.all(), "isbn", isbn] as const,
} as const;
