/**
 * React Query keys for Post queries
 */

import type { PostFilters } from "./post.types";

export const postKeys = {
  /**
   * Base key for all post queries
   */
  all: () => ["posts"] as const,

  /**
   * Keys for list queries
   */
  lists: () => [...postKeys.all(), "list"] as const,
  list: (filters?: PostFilters) => [...postKeys.lists(), filters] as const,

  /**
   * Keys for detail queries
   */
  details: () => [...postKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...postKeys.details(), unitId] as const,

  /**
   * Keys for target-specific queries (posts about a unit)
   */
  byTarget: (targetUnitId: string) =>
    [...postKeys.all(), "target", targetUnitId] as const,

  /**
   * Keys for author-specific queries
   */
  byAuthor: (authorUserId: string) =>
    [...postKeys.all(), "author", authorUserId] as const,

  /**
   * Keys for thread queries (replies under a root post)
   */
  thread: (rootPostUnitId: string) =>
    [...postKeys.all(), "thread", rootPostUnitId] as const,

  /**
   * Keys for direct reply queries
   */
  replies: (parentPostUnitId: string) =>
    [...postKeys.all(), "replies", parentPostUnitId] as const,

  /**
   * Keys for realm-scoped queries
   */
  byRealm: (realmUnitId: string) =>
    [...postKeys.all(), "realm", realmUnitId] as const,
} as const;
