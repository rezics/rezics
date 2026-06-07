import type { DashboardSummaryQuery } from "@rezics/contract";

/**
 * Dashboard query keys. The root prefix is `["dashboard"]` so the
 * cache-coherence map's `dashboard` namespace invalidation reaches every
 * dashboard query.
 */
export const dashboardKeys = {
  all: () => ["dashboard"] as const,
  summary: (query?: DashboardSummaryQuery) =>
    [...dashboardKeys.all(), "summary", query ?? {}] as const,
} as const;
