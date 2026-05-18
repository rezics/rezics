/**
 * React Query keys for the `/subscription/*` endpoint family. Mirrors
 * the `userKeys` / `creditAttributionKeys` shape used elsewhere in the api
 * package so cache-invalidation predicates can be written uniformly.
 */
export const subscriptionKeys = {
  all: () => ["subscription"] as const,
  mine: (filter?: { targetType?: string }) =>
    [...subscriptionKeys.all(), "mine", filter ?? {}] as const,
  check: (targetUnitId: string) =>
    [...subscriptionKeys.all(), "check", targetUnitId] as const,
  count: (targetUnitId: string) =>
    [...subscriptionKeys.all(), "count", targetUnitId] as const,
} as const;
