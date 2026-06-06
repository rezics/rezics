export const creditAttributionKeys = {
  all: () => ["credit-attribution"] as const,
  byUnit: (unitId: string) =>
    [...creditAttributionKeys.all(), "by-unit", unitId] as const,
} as const;
