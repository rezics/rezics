/**
 * React Query keys for the `/subscription/*` endpoint family. Mirrors
 * the `userKeys` / `creditAttributionKeys` shape used elsewhere in the api
 * package so cache-invalidation predicates can be written uniformly.
 */
export const subscriptionKeys = {
  all: () => ["subscription"] as const,
  mine: (filter?: { subscribedType?: string }) =>
    [...subscriptionKeys.all(), "mine", filter ?? {}] as const,
  entries: (filter?: {
    subscribedType?: string;
    state?: string;
    sort?: string;
    start?: number | string | null;
    limit?: number | string | null;
  }) => [...subscriptionKeys.all(), "entries", filter ?? {}] as const,
  check: (subscribedUnitId: string) =>
    [...subscriptionKeys.all(), "check", subscribedUnitId] as const,
  count: (subscribedUnitId: string) =>
    [...subscriptionKeys.all(), "count", subscribedUnitId] as const,
} as const;
