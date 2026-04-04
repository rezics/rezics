export const adminStatsKeys = {
  all: () => ['admin-stats'] as const,
  stats: () => [...adminStatsKeys.all(), 'stats'] as const,
} as const;
