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
  detail: (unitId: string) => [...bookKeys.details(), unitId] as const,
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
   * Keys for entity (attribution) queries
   */
  byEntity: (entityId: string) =>
    [...bookKeys.all(), "entity", entityId] as const,

  /**
   * Keys for ISBN lookup
   */
  byIsbn: (isbn13: string) => [...bookKeys.all(), "isbn", isbn13] as const,

  /**
   * Keys for tag-filtered queries
   */
  byTags: (tagUnitIds: string) =>
    [...bookKeys.all(), "tags", tagUnitIds] as const,
} as const;
