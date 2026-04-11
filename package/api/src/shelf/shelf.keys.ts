/**
 * React Query keys for Shelf queries
 */

import type { ShelfFilters } from "./shelf.types";

export const shelfKeys = {
  /**
   * Base key for all shelf queries
   */
  all: () => ["shelves"] as const,

  /**
   * Keys for list queries
   */
  lists: () => [...shelfKeys.all(), "list"] as const,
  list: (filters?: ShelfFilters) => [...shelfKeys.lists(), filters] as const,

  /**
   * Keys for detail queries
   */
  details: () => [...shelfKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...shelfKeys.details(), unitId] as const,

  /**
   * Keys for user-specific queries
   */
  byUser: (userId: string) => [...shelfKeys.all(), "user", userId] as const,
} as const;
