/**
 * React Query keys for Readlist queries
 */

import type { ReadlistFilters } from "./readlist.types";

export const readlistKeys = {
  /**
   * Base key for all readlist queries
   */
  all: () => ["readlists"] as const,

  /**
   * Keys for list queries
   */
  lists: () => [...readlistKeys.all(), "list"] as const,
  list: (filters?: ReadlistFilters) =>
    [...readlistKeys.lists(), filters] as const,

  /**
   * Keys for detail queries
   */
  details: () => [...readlistKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...readlistKeys.details(), unitId] as const,

  /**
   * Keys for search queries
   */
  searches: () => [...readlistKeys.all(), "search"] as const,
  search: (query: string, filters?: ReadlistFilters) =>
    [...readlistKeys.searches(), { q: query, ...filters }] as const,

  /**
   * Keys for user-specific queries
   */
  byUser: (userId: string) => [...readlistKeys.all(), "user", userId] as const,
} as const;
