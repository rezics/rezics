/**
 * React Query keys for Reaction queries
 */

export const normalizeIds = (ids: readonly string[]): string[] =>
  Array.from(new Set(ids)).sort();

export const reactionKeys = {
  all: () => ["reactions"] as const,

  summaries: () => [...reactionKeys.all(), "summary"] as const,
  summary: (targetId: string) =>
    [...reactionKeys.summaries(), { targetId }] as const,
  summaryBatch: (targetIds: readonly string[]) =>
    [...reactionKeys.summaries(), "batch", normalizeIds(targetIds)] as const,

  mine: () => [...reactionKeys.all(), "my"] as const,
  my: (targetId: string) => [...reactionKeys.mine(), { targetId }] as const,
  myBatch: (targetIds: readonly string[]) =>
    [...reactionKeys.mine(), "batch", normalizeIds(targetIds)] as const,

  histories: () => [...reactionKeys.all(), "history"] as const,
  given: (userId: string, reactions?: string) =>
    [
      ...reactionKeys.histories(),
      "given",
      { userId, reactions: reactions ?? null },
    ] as const,
  received: (userId: string, reactions?: string) =>
    [
      ...reactionKeys.histories(),
      "received",
      { userId, reactions: reactions ?? null },
    ] as const,
} as const;
