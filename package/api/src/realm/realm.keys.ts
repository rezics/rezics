/**
 * React Query keys for Realm queries
 */

import type { RealmFilters } from "./realm.types";

type RealmReadQuery = {
  view?: "joined" | "managing";
  explicitLanguage?: string;
  languages?: string | readonly string[];
  appLocale?: string;
  languageMode?: "preferred" | "all";
};

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
  detail: (unitId: string, query?: RealmReadQuery) =>
    query === undefined
      ? ([...realmKeys.details(), unitId] as const)
      : ([...realmKeys.details(), unitId, query] as const),

  /**
   * Keys for search queries
   */
  searches: () => [...realmKeys.all(), "search"] as const,
  search: (query: string, filters?: RealmFilters) =>
    [...realmKeys.searches(), { q: query, ...filters }] as const,

  /**
   * Keys for membership invalidation
   */
  members: (realmUnitId: string) =>
    [...realmKeys.all(), "members", realmUnitId] as const,
  memberList: (realmUnitId: string, cursor?: string | null) =>
    [...realmKeys.members(realmUnitId), "list", cursor ?? null] as const,

  /**
   * Keys for realm rule policy reads
   */
  rules: (realmUnitId: string) =>
    [...realmKeys.all(), "rules", realmUnitId] as const,
  ruleResolveds: (realmUnitId: string) =>
    [...realmKeys.rules(realmUnitId), "resolved"] as const,
  ruleResolved: (
    realmUnitId: string,
    language?: string,
    query?: { languages?: string | readonly string[]; appLocale?: string },
  ) =>
    [
      ...realmKeys.ruleResolveds(realmUnitId),
      language ?? null,
      query ?? null,
    ] as const,

  /**
   * Keys for realm content invalidation
   */
  units: (realmUnitId: string) =>
    [...realmKeys.all(), "units", realmUnitId] as const,

  /**
   * Keys for realm tag-application invalidation
   */
  tagApplications: (realmUnitId: string) =>
    [...realmKeys.all(), "tagApplications", realmUnitId] as const,

  tagContext: (realmUnitId: string, tagUnitId: string) =>
    [...realmKeys.all(), "tagContexts", realmUnitId, tagUnitId] as const,

  mine: (query?: RealmReadQuery) =>
    [...realmKeys.all(), "mine", query ?? null] as const,
  byMember: (userId: string, query?: RealmReadQuery) =>
    [...realmKeys.all(), "member", userId, query ?? null] as const,
} as const;
