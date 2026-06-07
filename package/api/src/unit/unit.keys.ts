/**
 * React Query keys for Unit queries
 */

import type { UnitLanguageContentQuery } from "@rezics/contract";
import type { UnitFilters } from "./unit.types";

export const unitKeys = {
  /**
   * Base key for all unit queries
   */
  all: () => ["units"] as const,

  /**
   * Keys for list queries
   */
  lists: () => [...unitKeys.all(), "list"] as const,
  list: (filters?: UnitFilters) => [...unitKeys.lists(), filters] as const,

  /**
   * Keys for detail queries
   */
  details: () => [...unitKeys.all(), "detail"] as const,
  detail: (
    unitId: string,
    query?: {
      explicitLanguage?: string;
      languages?: string | readonly string[];
      appLocale?: string;
      languageMode?: "preferred" | "all";
    },
  ) =>
    query === undefined
      ? ([...unitKeys.details(), unitId] as const)
      : ([...unitKeys.details(), unitId, query] as const),
  languages: (unitId: string) =>
    [...unitKeys.details(), unitId, "languages"] as const,
  languageContent: (unitId: string, query?: UnitLanguageContentQuery) =>
    [...unitKeys.languages(unitId), "content", query] as const,

  /**
   * Keys for user-specific queries
   */
  byUser: (userId: string, filters?: UnitFilters) =>
    [...unitKeys.all(), "user", userId, filters ?? null] as const,

  /**
   * Keys for slug lookup queries
   */
  bySlug: (unitSlug: string) =>
    [...unitKeys.all(), "by-slug", { unitSlug }] as const,

  /**
   * Keys for search queries
   */
  searches: () => [...unitKeys.all(), "search"] as const,
  search: (query: string, filters?: UnitFilters) =>
    [...unitKeys.searches(), { q: query, ...filters }] as const,
} as const;
