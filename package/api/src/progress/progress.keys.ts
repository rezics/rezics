import type { UnitProgressListQuery } from "@rezics/contract";

export const progressKeys = {
  all: () => ["progress"] as const,
  unit: (unitId: string) => [...progressKeys.all(), "unit", unitId] as const,
  stats: (unitId: string) => [...progressKeys.all(), "stats", unitId] as const,
  lists: () => [...progressKeys.all(), "list"] as const,
  list: (query?: UnitProgressListQuery) =>
    [...progressKeys.lists(), query ?? {}] as const,
} as const;
