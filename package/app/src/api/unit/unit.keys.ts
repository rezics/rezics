/**
 * React Query keys for Unit queries
 */

import type {UnitFilters} from './unit.types';

export const unitKeys = {
  /**
   * Base key for all unit queries
   */
  all: () => ['units'] as const,

  /**
   * Keys for list queries
   */
  lists: () => [...unitKeys.all(), 'list'] as const,
  list: (filters?: UnitFilters) => [...unitKeys.lists(), filters] as const,

  /**
   * Keys for detail queries
   */
  details: () => [...unitKeys.all(), 'detail'] as const,
  detail: (unitId: string) => [...unitKeys.details(), unitId] as const,

  /**
   * Keys for user-specific queries (convenience)
   */
  byUser: (userId: string) => [...unitKeys.all(), 'user', userId] as const,

  /**
   * Keys for search queries
   */
  searches: () => [...unitKeys.all(), 'search'] as const,
  search: (query: string, filters?: UnitFilters) =>
    [...unitKeys.searches(), {q: query, ...filters}] as const,
} as const;
