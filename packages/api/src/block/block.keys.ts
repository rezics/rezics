/**
 * React Query keys for block queries.
 */

export const blockKeys = {
  all: () => ["blocks"] as const,
  list: () => [...blockKeys.all(), "list"] as const,
} as const;
