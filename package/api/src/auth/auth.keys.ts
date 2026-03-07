/**
 * React Query keys for Auth queries
 */

export const authKeys = {
  all: () => ['auth'] as const,
  session: () => [...authKeys.all(), 'session'] as const,
  sessions: () => [...authKeys.all(), 'sessions'] as const,
  adminUsers: () => [...authKeys.all(), 'admin', 'users'] as const,
  adminUserList: (filters?: Record<string, unknown>) =>
    [...authKeys.adminUsers(), filters] as const,
} as const;
