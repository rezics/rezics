/**
 * React Query keys for Reaction queries
 */

export const normalizeIds = (ids: readonly string[]): string[] =>
  Array.from(new Set(ids)).sort();

export const normalizeContextForKey = (
  contextUnitId?: string | null,
): string | null | undefined => {
  if (contextUnitId === undefined) return undefined;
  return contextUnitId && contextUnitId.length > 0 ? contextUnitId : null;
};

export const reactionKeys = {
  all: () => ["reactions"] as const,

  summaries: () => [...reactionKeys.all(), "summary"] as const,
  summary: (targetId: string, contextUnitId?: string | null) =>
    [
      ...reactionKeys.summaries(),
      { targetId, contextUnitId: normalizeContextForKey(contextUnitId) },
    ] as const,
  summaryBatch: (targetIds: readonly string[], contextUnitId?: string | null) =>
    [
      ...reactionKeys.summaries(),
      "batch",
      {
        targetIds: normalizeIds(targetIds),
        contextUnitId: normalizeContextForKey(contextUnitId),
      },
    ] as const,

  shareSummaries: () => [...reactionKeys.all(), "share-summary"] as const,
  shareSummaryBatch: (targetIds: readonly string[]) =>
    [
      ...reactionKeys.shareSummaries(),
      "batch",
      normalizeIds(targetIds),
    ] as const,

  mine: () => [...reactionKeys.all(), "my"] as const,
  my: (targetId: string, contextUnitId?: string | null) =>
    [
      ...reactionKeys.mine(),
      { targetId, contextUnitId: normalizeContextForKey(contextUnitId) },
    ] as const,
  myBatch: (targetIds: readonly string[], contextUnitId?: string | null) =>
    [
      ...reactionKeys.mine(),
      "batch",
      {
        targetIds: normalizeIds(targetIds),
        contextUnitId: normalizeContextForKey(contextUnitId),
      },
    ] as const,

  histories: () => [...reactionKeys.all(), "history"] as const,
  given: (userId: string, reactions?: string, contextUnitId?: string | null) =>
    [
      ...reactionKeys.histories(),
      "given",
      {
        userId,
        reactions: reactions ?? null,
        contextUnitId: normalizeContextForKey(contextUnitId),
      },
    ] as const,
  received: (userId: string, reactions?: string) =>
    [
      ...reactionKeys.histories(),
      "received",
      { userId, reactions: reactions ?? null },
    ] as const,
} as const;
