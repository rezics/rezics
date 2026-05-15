import { isAggregatable, KIND_REGISTRY } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { mapToAggregatedItems } from "./notification.mapper";

const AGGREGATABLE_KINDS: string[] = Object.entries(KIND_REGISTRY)
  .filter(([, cfg]) => cfg.aggregatable)
  .map(([kind]) => kind);

const NON_AGGREGATABLE_KINDS: string[] = Object.entries(KIND_REGISTRY)
  .filter(([, cfg]) => !cfg.aggregatable)
  .map(([kind]) => kind);

type AggregatedRow = {
  kind: string;
  sourceUnitId: string;
  actorIds: string[];
  count: bigint;
  latestAt: Date;
  allRead: boolean;
  extra: unknown;
};

/**
 * Persist N notification rows (one per recipient) via a single batched insert
 * and return the synthesized raw events for SSE fan-out. The raw event uses
 * the input data + a per-row uuid (we generate IDs locally via uuid since
 * createMany on this Prisma version does not return the inserted rows).
 *
 * Caller (the `/internal/event` handler) iterates SSE publish on the returned
 * events.
 */
export async function broadcastNotifications(input: {
  kind: string;
  sourceUnitId: string;
  recipientIds: string[];
  actorId: string | null;
  extra?: unknown;
}): Promise<
  Array<{
    recipientId: string;
    raw: {
      id: string;
      kind: string;
      sourceUnitId: string;
      actorId: string | null;
      extra: unknown;
      createdAt: string;
    };
  }>
> {
  const { kind, sourceUnitId, recipientIds, actorId } = input;
  const extra = input.extra ?? null;
  if (recipientIds.length === 0) return [];

  // Use crypto.randomUUID — these IDs are also used for SSE event identity.
  // We choose IDs client-side so SSE can synthesize the raw event without a
  // second SELECT round-trip after createMany.
  const rows = recipientIds.map((recipientId) => ({
    id: crypto.randomUUID(),
    recipientId,
    actorId,
    kind,
    sourceUnitId,
    extra: extra as never,
  }));

  await prisma.notification.createMany({
    data: rows,
    skipDuplicates: false,
  });

  const createdAt = new Date().toISOString();
  return rows.map((row) => ({
    recipientId: row.recipientId,
    raw: {
      id: row.id,
      kind: row.kind,
      sourceUnitId: row.sourceUnitId,
      actorId: row.actorId,
      extra,
      createdAt,
    },
  }));
}

export async function getNotifications(
  recipientId: string,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;

  // Aggregatable rows grouped by (kind, sourceUnitId).
  const aggregated = await prisma.$queryRawUnsafe<AggregatedRow[]>(
    `
    SELECT
      kind,
      "sourceUnitId",
      array_agg("actorId" ORDER BY "createdAt" DESC) FILTER (WHERE "actorId" IS NOT NULL) AS "actorIds",
      count(*)::bigint AS count,
      max("createdAt") AS "latestAt",
      bool_and(read) AS "allRead",
      (array_agg(extra ORDER BY "createdAt" DESC))[1] AS extra
    FROM "Notification"
    WHERE "recipientId" = $1::uuid
      AND kind = ANY($2::text[])
    GROUP BY kind, "sourceUnitId"
    ORDER BY "latestAt" DESC
    `,
    recipientId,
    AGGREGATABLE_KINDS,
  );

  // Non-aggregatable rows returned individually.
  const individual = await prisma.notification.findMany({
    where: {
      recipientId,
      kind: { in: NON_AGGREGATABLE_KINDS },
    },
    orderBy: { createdAt: "desc" },
  });

  const items = mapToAggregatedItems(aggregated, individual);

  items.sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
  );

  const total = items.length;
  const paged = items.slice(offset, offset + limit);

  return { items: paged, total, page, limit };
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  const aggregatedResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `
    SELECT count(*) AS count FROM (
      SELECT 1
      FROM "Notification"
      WHERE "recipientId" = $1::uuid
        AND kind = ANY($2::text[])
        AND read = false
      GROUP BY kind, "sourceUnitId"
    ) sub
    `,
    recipientId,
    AGGREGATABLE_KINDS,
  );

  const individualCount = await prisma.notification.count({
    where: {
      recipientId,
      kind: { in: NON_AGGREGATABLE_KINDS },
      read: false,
    },
  });

  const aggregatedCount = Number(aggregatedResult[0]?.count ?? 0);
  return aggregatedCount + individualCount;
}

export async function markAsRead(
  recipientId: string,
  kind: string,
  sourceUnitId: string,
) {
  await prisma.notification.updateMany({
    where: {
      recipientId,
      kind,
      sourceUnitId,
      read: false,
    },
    data: { read: true, readAt: new Date() },
  });
}

export async function markAllAsRead(recipientId: string) {
  await prisma.notification.updateMany({
    where: { recipientId, read: false },
    data: { read: true, readAt: new Date() },
  });
}

export async function deleteNotification(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!notification || notification.recipientId !== userId) return false;

  await prisma.notification.delete({ where: { id: notificationId } });
  return true;
}

// Re-export the predicate for callers that import via this service.
export { isAggregatable };
