import type { EntityListQuery } from "@rezics/contract";

export const entityKeys = {
  all: () => ["entity"] as const,
  lists: () => [...entityKeys.all(), "list"] as const,
  list: (query?: EntityListQuery) => [...entityKeys.lists(), query] as const,
  searches: () => [...entityKeys.all(), "search"] as const,
  search: (query?: EntityListQuery) =>
    [...entityKeys.searches(), query] as const,
  details: () => [...entityKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...entityKeys.details(), unitId] as const,
  bySlug: (slug: string) => [...entityKeys.all(), "by-slug", slug] as const,
} as const;
