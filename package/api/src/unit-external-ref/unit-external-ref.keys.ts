import type { UnitExternalRefListQuery } from "@rezics/contract";

export const unitExternalRefKeys = {
  all: () => ["unit-external-ref"] as const,
  lists: () => [...unitExternalRefKeys.all(), "list"] as const,
  list: (query?: UnitExternalRefListQuery) =>
    [...unitExternalRefKeys.lists(), query] as const,
  parseUrl: (sourceSiteEntityUnitId: string, url: string) =>
    [
      ...unitExternalRefKeys.all(),
      "parse-url",
      sourceSiteEntityUnitId,
      url,
    ] as const,
} as const;
