import type { ShelfFilters, ShelfItemsQuery } from "./shelf.types";

export const shelfKeys = {
  all: () => ["shelves"] as const,
  lists: () => [...shelfKeys.all(), "list"] as const,
  list: (filters?: ShelfFilters) => [...shelfKeys.lists(), filters] as const,
  details: () => [...shelfKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...shelfKeys.details(), unitId] as const,
  byUser: (userId: string) => [...shelfKeys.all(), "user", userId] as const,
  mine: () => [...shelfKeys.all(), "mine"] as const,
  items: (unitId: string) => [...shelfKeys.all(), "items", unitId] as const,
  itemsPage: (unitId: string, query?: ShelfItemsQuery) =>
    [...shelfKeys.items(unitId), query] as const,
} as const;

export const collectionKeys = {
  all: () => ["collection"] as const,
  status: (targetId: string) =>
    [...collectionKeys.all(), "status", targetId] as const,
} as const;
