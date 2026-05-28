export const accountOperationsKeys = {
  all: () => ["account-operations"] as const,
  authUsers: () => [...accountOperationsKeys.all(), "auth-users"] as const,
  authUserSummary: (authUserIds: string[]) =>
    [...accountOperationsKeys.authUsers(), "summary", authUserIds] as const,
} as const;
