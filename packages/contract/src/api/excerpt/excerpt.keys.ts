/**
 * React Query keys for excerpt queries
 */

export const excerptKeys = {
  all: () => ["excerpt"] as const,
  details: () => [...excerptKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...excerptKeys.details(), unitId] as const,
} as const;
