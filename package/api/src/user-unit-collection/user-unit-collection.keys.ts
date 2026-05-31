export const userUnitCollectionKeys = {
  all: () => ["user-unit-collections"] as const,
  unit: (unitId: string) =>
    [...userUnitCollectionKeys.all(), "unit", unitId] as const,
} as const;
