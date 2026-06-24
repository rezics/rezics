import type { UnitAliasListQuery } from "@rezics/contract";

export const unitAliasKeys = {
  all: () => ["unitAliases"] as const,
  lists: () => [...unitAliasKeys.all(), "list"] as const,
  list: (query?: UnitAliasListQuery) =>
    [...unitAliasKeys.lists(), query] as const,
  forUnit: (unitId: string) =>
    [...unitAliasKeys.lists(), "unit", unitId] as const,
  detail: (aliasId: string) =>
    [...unitAliasKeys.all(), "detail", aliasId] as const,
} as const;
