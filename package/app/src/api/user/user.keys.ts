/**
 * React Query keys for User queries
 */

export const userKeys = {
  all: () => ['users'] as const,
  lists: () => [...userKeys.all(), 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all(), 'detail'] as const,
  detail: (unitId: string) => [...userKeys.details(), unitId] as const,
  searches: () => [...userKeys.all(), 'search'] as const,
  search: (q: string, filters?: Record<string, unknown>) =>
    [...userKeys.searches(), {q, ...filters}] as const,
} as const;
