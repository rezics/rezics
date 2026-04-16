import type { EntityListQuery } from "@rezics/contract";

export const attributionKeys = {
  all: () => ["attribution"] as const,

  // Entities
  entityLists: () => [...attributionKeys.all(), "entities", "list"] as const,
  entityList: (query?: EntityListQuery) =>
    [...attributionKeys.entityLists(), query] as const,
  entityDetails: () =>
    [...attributionKeys.all(), "entities", "detail"] as const,
  entityDetail: (id: string) =>
    [...attributionKeys.entityDetails(), id] as const,

  // Attributions by unit
  attributionsByUnit: (unitId: string) =>
    [...attributionKeys.all(), "credits", unitId] as const,
} as const;
