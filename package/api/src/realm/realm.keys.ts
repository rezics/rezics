/**
 * React Query keys for Realm queries
 */

import type { RealmFilters } from "./realm.types";

export const realmKeys = {
  /**
   * Base key for all realm queries
   */
  all: () => ["realms"] as const,

  /**
   * Keys for list queries
   */
  lists: () => [...realmKeys.all(), "list"] as const,
  list: (filters?: RealmFilters) => [...realmKeys.lists(), filters] as const,

  /**
   * Keys for detail queries
   */
  details: () => [...realmKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...realmKeys.details(), unitId] as const,

  /**
   * Keys for search queries
   */
  searches: () => [...realmKeys.all(), "search"] as const,
  search: (query: string, filters?: RealmFilters) =>
    [...realmKeys.searches(), { q: query, ...filters }] as const,

  /**
   * Keys for membership queries
   */
  members: (realmUnitId: string) =>
    [...realmKeys.all(), "members", realmUnitId] as const,

  /**
   * Keys for realm content (units)
   */
  units: (realmUnitId: string) =>
    [...realmKeys.all(), "units", realmUnitId] as const,

  /**
   * Keys for realm tag-unit associations
   */
  tagUnits: (realmUnitId: string) =>
    [...realmKeys.all(), "tagUnits", realmUnitId] as const,
} as const;
