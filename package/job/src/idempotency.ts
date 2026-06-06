export type IdempotencyPart = string | number | boolean | null | undefined;

function normalizePart(part: IdempotencyPart): string {
  if (part === null || part === undefined) return "_";
  return String(part).trim().replaceAll(":", "_");
}

export function createIdempotencyKey(
  kind: string,
  ...parts: IdempotencyPart[]
): string {
  return [
    kind,
    ...parts.filter((part) => part !== undefined).map(normalizePart),
  ].join(":");
}

export const searchIdempotency = {
  content: (operation: string, unitId: string) =>
    createIdempotencyKey(`search.content.${operation}`, unitId),
  post: (operation: string, postId: string) =>
    createIdempotencyKey(`search.post.${operation}`, postId),
  realm: (operation: string, realmId: string) =>
    createIdempotencyKey(`search.realm.${operation}`, realmId),
  entity: (operation: string, entityId: string) =>
    createIdempotencyKey(`search.entity.${operation}`, entityId),
  user: (operation: string, userId: string) =>
    createIdempotencyKey(`search.user.${operation}`, userId),
  feedback: (operation: string, feedbackId: string) =>
    createIdempotencyKey(`search.feedback.${operation}`, feedbackId),
  progress: (operation: string, userId: string, unitId: string) =>
    createIdempotencyKey(`search.progress.${operation}`, userId, unitId),
  index: (operation: string, index: string, cursor?: string | null) =>
    createIdempotencyKey(`search.index.${operation}`, index, cursor),
  fanout: (operation: string, targetId: string, cursor?: string | null) =>
    createIdempotencyKey(`search.fanout.${operation}`, targetId, cursor),
};

export const historyIdempotency = {
  outboxIngest: (outboxId: string) =>
    createIdempotencyKey("history.outbox.ingest", outboxId),
};

export type RankingIdempotencyScope = {
  kind: string;
  id?: string | null;
};

export const rankingIdempotency = {
  target: (
    kind: string,
    unitId: string,
    scope?: RankingIdempotencyScope,
    rankKind?: string,
  ) =>
    createIdempotencyKey(
      kind,
      unitId,
      scope?.kind,
      scope?.id ?? (scope ? "global" : undefined),
      rankKind,
    ),
  patchServing: (target: string, rankKind?: string) =>
    createIdempotencyKey("ranking.patchServing", target, rankKind),
  fullSync: (cursor?: string | null, rankKind?: string) =>
    createIdempotencyKey("ranking.fullSync", cursor, rankKind),
  viewBucketFlush: (cursor?: string | null) =>
    createIdempotencyKey("ranking.viewBucketFlush", cursor),
  reactionBucket: (
    targetId: string,
    scopeKey: string,
    reaction: string,
    at?: string | null,
  ) =>
    createIdempotencyKey(
      "ranking.reactionBucket",
      targetId,
      scopeKey,
      reaction,
      at,
    ),
};

export const maintenanceIdempotency = {
  driftRepair: (targetType: string, targetId: string) =>
    createIdempotencyKey(
      "maintenance.search.driftRepair",
      targetType,
      targetId,
    ),
  rebuildIndex: (index: string, cursor?: string | null) =>
    createIdempotencyKey("maintenance.search.rebuildIndex", index, cursor),
  replay: (scope: string, key: string) =>
    createIdempotencyKey("maintenance.replay", scope, key),
  fanoutContinuation: (fanout: string, targetId: string, cursor: string) =>
    createIdempotencyKey(
      "maintenance.fanout.continuation",
      fanout,
      targetId,
      cursor,
    ),
  seriesRepair: (operation: string, seriesUnitId: string) =>
    createIdempotencyKey("maintenance.series", operation, seriesUnitId),
};
