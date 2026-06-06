/**
 * Dashboard query keys. The root prefix is `["dashboard"]` so the
 * cache-coherence map's `dashboard` namespace invalidation reaches every
 * dashboard query.
 */
export const dashboardKeys = {
  all: () => ["dashboard"] as const,
  summary: () => [...dashboardKeys.all(), "summary"] as const,
} as const;
