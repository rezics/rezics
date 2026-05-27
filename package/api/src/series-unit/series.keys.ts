import type { SeriesListQuery } from "@rezics/contract";

export const seriesKeys = {
  all: () => ["series"] as const,
  lists: () => [...seriesKeys.all(), "list"] as const,
  list: (query: SeriesListQuery = {}) =>
    [...seriesKeys.lists(), query] as const,
  details: () => [...seriesKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...seriesKeys.details(), unitId] as const,
  contentIndex: (unitId: string) =>
    [...seriesKeys.detail(unitId), "contentIndex"] as const,
  diagnostics: (unitId: string) =>
    [...seriesKeys.detail(unitId), "diagnostics"] as const,
  relatedByWork: (workUnitId: string) =>
    [...seriesKeys.all(), "relatedByWork", workUnitId] as const,
  representativeReleaseSuggestions: (
    workUnitId: string,
    explicitReleaseUnitId?: string,
  ) =>
    [
      ...seriesKeys.all(),
      "representativeReleaseSuggestions",
      workUnitId,
      explicitReleaseUnitId ?? null,
    ] as const,
} as const;
