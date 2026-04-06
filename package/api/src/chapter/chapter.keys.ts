/**
 * React Query keys for Chapter queries
 */

import type { ChapterFilters } from "./chapter.types";

export const chapterKeys = {
  /**
   * Base key for all chapter queries
   */
  all: () => ["chapters"] as const,

  /**
   * Keys for list queries
   */
  lists: () => [...chapterKeys.all(), "list"] as const,
  list: (filters?: ChapterFilters) =>
    [...chapterKeys.lists(), filters] as const,

  /**
   * Keys for detail queries
   */
  details: () => [...chapterKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...chapterKeys.details(), unitId] as const,

  /**
   * Keys for search queries
   */
  searches: () => [...chapterKeys.all(), "search"] as const,
  search: (query: string, filters?: ChapterFilters) =>
    [...chapterKeys.searches(), { q: query, ...filters }] as const,

  /**
   * Keys for user-specific queries
   */
  byUser: (userId: string) => [...chapterKeys.all(), "user", userId] as const,

  /**
   * Keys for target unit (book/parent) queries
   */
  byTargetUnit: (targetUnitId: string) =>
    [...chapterKeys.all(), "target", targetUnitId] as const,
} as const;
