/**
 * React Query keys for Tag queries
 */

import type { TagFilters } from "./tag.types";

export const tagKeys = {
  all: () => ["tags"] as const,

  // list keys
  lists: () => [...tagKeys.all(), "list"] as const,
  list: (filters?: TagFilters) => [...tagKeys.lists(), filters] as const,

  // detail
  details: () => [...tagKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...tagKeys.details(), unitId] as const,

  // tags for a specific unit (scored associations)
  forUnit: (unitId: string) => [...tagKeys.all(), "forUnit", unitId] as const,

  // tag context (global tags + realm highlights)
  context: (unitId: string) => [...tagKeys.all(), "context", unitId] as const,

  // batch translations for a set of tag unit IDs in a language
  translations: (tagUnitIds: string[], lang: string) =>
    [
      ...tagKeys.all(),
      "translations",
      [...tagUnitIds].sort().join(","),
      lang,
    ] as const,

  // votes
  votes: () => [...tagKeys.all(), "votes"] as const,
} as const;
