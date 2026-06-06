import type { SourceSiteListQuery } from "@rezics/contract";

export const sourceSiteKeys = {
  all: () => ["source-site"] as const,
  lists: () => [...sourceSiteKeys.all(), "list"] as const,
  list: (query?: SourceSiteListQuery) =>
    [...sourceSiteKeys.lists(), query] as const,
  details: () => [...sourceSiteKeys.all(), "detail"] as const,
  detail: (entityUnitId: string) =>
    [...sourceSiteKeys.details(), entityUnitId] as const,
} as const;
