export const adminStatsKeys = {
  all: () => ["admin-stats"] as const,
  stats: () => [...adminStatsKeys.all(), "stats"] as const,
  dashboardSummary: () =>
    [...adminStatsKeys.all(), "dashboard-summary"] as const,
} as const;
