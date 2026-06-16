export const userShelfItemKeys = {
  all: () => ["user-shelf-items"] as const,
  unit: (unitId: string) =>
    [...userShelfItemKeys.all(), "unit", unitId] as const,
  searchMine: (query: unknown) =>
    [...userShelfItemKeys.all(), "search", "me", query] as const,
  searchUser: (userId: string, query: unknown) =>
    [...userShelfItemKeys.all(), "search", "user", userId, query] as const,
} as const;
