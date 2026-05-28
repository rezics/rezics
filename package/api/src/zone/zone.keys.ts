export const zoneKeys = {
  all: () => ["zones"] as const,
  details: () => [...zoneKeys.all(), "detail"] as const,
  detail: (slug: string) => [...zoneKeys.details(), slug] as const,
  byUnitId: (unitId: string) =>
    [...zoneKeys.details(), "unit", unitId] as const,
} as const;
