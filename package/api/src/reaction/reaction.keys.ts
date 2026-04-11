/**
 * React Query keys for Reaction queries
 */

export const reactionKeys = {
  all: () => ["reactions"] as const,

  summaries: () => [...reactionKeys.all(), "summary"] as const,
  summary: (targetId: string) =>
    [...reactionKeys.summaries(), { targetId }] as const,

  mine: () => [...reactionKeys.all(), "my"] as const,
  my: (targetId: string) => [...reactionKeys.mine(), { targetId }] as const,
} as const;
