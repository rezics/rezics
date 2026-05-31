export const userUnitCollectionKeys = {
  all: () => ["user-unit-collections"] as const,
  unit: (unitId: string) =>
    [...userUnitCollectionKeys.all(), "unit", unitId] as const,
  searchMine: (query: unknown) =>
    [...userUnitCollectionKeys.all(), "search", "me", query] as const,
  searchUser: (userId: string, query: unknown) =>
    [...userUnitCollectionKeys.all(), "search", "user", userId, query] as const,
} as const;
