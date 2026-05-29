/**
 * React Query keys for Poll queries.
 */

export const pollKeys = {
  all: () => ["polls"] as const,

  // a single poll's results (poll + options + tallies + caller's vote)
  details: () => [...pollKeys.all(), "detail"] as const,
  detail: (pollUnitId: string) => [...pollKeys.details(), pollUnitId] as const,
} as const;
