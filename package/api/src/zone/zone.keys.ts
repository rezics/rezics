export const zoneKeys = {
  all: () => ["zones"] as const,
  details: () => [...zoneKeys.all(), "detail"] as const,
  detail: (slug: string) => [...zoneKeys.details(), slug] as const,
  byUnitId: (unitId: string) =>
    [...zoneKeys.details(), "unit", unitId] as const,
  homepageByUnitId: (unitId: string, languages: readonly string[] = []) =>
    [...zoneKeys.byUnitId(unitId), "homepage", [...languages]] as const,
} as const;
