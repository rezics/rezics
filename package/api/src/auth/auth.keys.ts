/**
 * React Query keys for Auth queries
 */

export const authKeys = {
  all: () => ['auth'] as const,
  session: () => [...authKeys.all(), 'session'] as const,
  sessionState: () => [...authKeys.all(), 'session-state'] as const,
  contextToken: () => [...authKeys.all(), 'context-token'] as const,
  sessions: () => [...authKeys.all(), 'sessions'] as const,
  providers: () => [...authKeys.all(), 'providers'] as const,
  adminUsers: () => [...authKeys.all(), 'admin', 'users'] as const,
  adminUserList: (filters?: Record<string, unknown>) =>
    [...authKeys.adminUsers(), filters] as const,
} as const;
