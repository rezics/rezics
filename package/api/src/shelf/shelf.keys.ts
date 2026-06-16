import type { ShelfFilters, ShelfItemsQuery } from "./shelf.types";

export type ShelfContainmentFilters = Omit<ShelfFilters, "containsUnitId">;
export type ShelfVariantFilters = Omit<ShelfFilters, "variantUnitId">;

export const normalizeShelfItemStatusIds = (ids: readonly string[]): string[] =>
  Array.from(new Set(ids.filter(Boolean))).sort();

export const shelfKeys = {
  all: () => ["shelves"] as const,
  lists: () => [...shelfKeys.all(), "list"] as const,
  list: (filters?: ShelfFilters) => [...shelfKeys.lists(), filters] as const,
  containingUnit: (unitId: string, filters?: ShelfContainmentFilters) =>
    [...shelfKeys.lists(), "containsUnit", unitId, filters ?? null] as const,
  variantContext: (variantUnitId: string, filters?: ShelfVariantFilters) =>
    [...shelfKeys.lists(), "variant", variantUnitId, filters ?? null] as const,
  details: () => [...shelfKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...shelfKeys.details(), unitId] as const,
  byUser: (userId: string, filters?: ShelfFilters) =>
    [...shelfKeys.all(), "user", userId, filters] as const,
  mine: (filters?: ShelfFilters) =>
    [...shelfKeys.all(), "mine", filters ?? null] as const,
  items: (unitId: string) => [...shelfKeys.all(), "items", unitId] as const,
  itemsPage: (unitId: string, query?: ShelfItemsQuery) =>
    [...shelfKeys.items(unitId), query] as const,
} as const;

export const shelfItemStatusKeys = {
  all: () => ["shelf-item-status"] as const,
  status: (targetId: string) =>
    [...shelfItemStatusKeys.all(), "status", targetId] as const,
  statusBatch: (targetIds: readonly string[]) =>
    [
      ...shelfItemStatusKeys.all(),
      "status",
      "batch",
      normalizeShelfItemStatusIds(targetIds),
    ] as const,
} as const;
