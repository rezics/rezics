export const userTagApplicationKeys = {
  all: () => ["user-tag-applications"] as const,
  unit: (unitId: string) =>
    [...userTagApplicationKeys.all(), "unit", unitId] as const,
} as const;
