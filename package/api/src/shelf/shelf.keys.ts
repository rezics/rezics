import type { ShelfFilters, ShelfUnitsQuery } from "./shelf.types";

export const normalizeCollectionIds = (ids: readonly string[]): string[] =>
  Array.from(new Set(ids.filter(Boolean))).sort();

export const shelfKeys = {
  all: () => ["shelves"] as const,
  lists: () => [...shelfKeys.all(), "list"] as const,
  list: (filters?: ShelfFilters) => [...shelfKeys.lists(), filters] as const,
  details: () => [...shelfKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...shelfKeys.details(), unitId] as const,
  byUser: (userId: string, filters?: ShelfFilters) =>
    [...shelfKeys.all(), "user", userId, filters] as const,
  mine: () => [...shelfKeys.all(), "mine"] as const,
  units: (unitId: string) => [...shelfKeys.all(), "units", unitId] as const,
  unitsPage: (unitId: string, query?: ShelfUnitsQuery) =>
    [...shelfKeys.units(unitId), query] as const,
} as const;

export const collectionKeys = {
  all: () => ["collection"] as const,
  status: (targetId: string) =>
    [...collectionKeys.all(), "status", targetId] as const,
  statusBatch: (targetIds: readonly string[]) =>
    [
      ...collectionKeys.all(),
      "status",
      "batch",
      normalizeCollectionIds(targetIds),
    ] as const,
} as const;
