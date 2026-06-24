import type { ActivityListQuery } from "@rezics/contract";

/**
 * Activity query keys. Root prefix is `["activity"]`; lists are scoped by the
 * profile userId plus the query (limit/before) so paging variants cache apart.
 */
export const activityKeys = {
  all: () => ["activity"] as const,
  list: (userId: string, query?: ActivityListQuery) =>
    [...activityKeys.all(), "list", userId, query ?? {}] as const,
} as const;
