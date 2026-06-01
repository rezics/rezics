/**
 * React Query keys for Reaction queries
 */

export const normalizeIds = (ids: readonly string[]): string[] =>
  Array.from(new Set(ids)).sort();

export const normalizeScopeForKey = (
  scopeKey?: string | null,
): string | null => (scopeKey && scopeKey.length > 0 ? scopeKey : null);

export const reactionKeys = {
  all: () => ["reactions"] as const,

  summaries: () => [...reactionKeys.all(), "summary"] as const,
  summary: (targetId: string, scopeKey?: string | null) =>
    [
      ...reactionKeys.summaries(),
      { targetId, scopeKey: normalizeScopeForKey(scopeKey) },
    ] as const,
  summaryBatch: (targetIds: readonly string[], scopeKey?: string | null) =>
    [
      ...reactionKeys.summaries(),
      "batch",
      {
        targetIds: normalizeIds(targetIds),
        scopeKey: normalizeScopeForKey(scopeKey),
      },
    ] as const,

  mine: () => [...reactionKeys.all(), "my"] as const,
  my: (targetId: string, scopeKey?: string | null) =>
    [
      ...reactionKeys.mine(),
      { targetId, scopeKey: normalizeScopeForKey(scopeKey) },
    ] as const,
  myBatch: (targetIds: readonly string[], scopeKey?: string | null) =>
    [
      ...reactionKeys.mine(),
      "batch",
      {
        targetIds: normalizeIds(targetIds),
        scopeKey: normalizeScopeForKey(scopeKey),
      },
    ] as const,

  histories: () => [...reactionKeys.all(), "history"] as const,
  given: (userId: string, reactions?: string, scopeKey?: string | null) =>
    [
      ...reactionKeys.histories(),
      "given",
      {
        userId,
        reactions: reactions ?? null,
        scopeKey: normalizeScopeForKey(scopeKey),
      },
    ] as const,
  received: (userId: string, reactions?: string) =>
    [
      ...reactionKeys.histories(),
      "received",
      { userId, reactions: reactions ?? null },
    ] as const,
} as const;
