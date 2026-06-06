import { isAggregatable, KIND_REGISTRY } from "@rezics/contract";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { type NotificationRow, notifications } from "../db/schema";
import { mapToAggregatedItems } from "./notification.mapper";

const AGGREGATABLE_KINDS: string[] = Object.entries(KIND_REGISTRY)
  .filter(([, cfg]) => cfg.aggregatable)
  .map(([kind]) => kind);

const NON_AGGREGATABLE_KINDS: string[] = Object.entries(KIND_REGISTRY)
  .filter(([, cfg]) => !cfg.aggregatable)
  .map(([kind]) => kind);

const AGGREGATABLE_KIND_LIST = sql.join(
  AGGREGATABLE_KINDS.map((kind) => sql`${kind}`),
  sql`, `,
);

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
 * Persist one notification row per recipient and return the inserted rows for
 * SSE fan-out. IDs stay database-generated through PostgreSQL 18 `uuidv7()`.
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

  const rows = await db
    .insert(notifications)
    .values(
      recipientIds.map((recipientId) => ({
        recipientId,
        actorId,
        kind,
        sourceUnitId,
        extra,
      })),
    )
    .returning();

  return rows.map((row) => ({
    recipientId: row.recipientId,
    raw: {
      id: row.id,
      kind: row.kind,
      sourceUnitId: row.sourceUnitId,
      actorId: row.actorId,
      extra: row.extra,
      createdAt: row.createdAt.toISOString(),
    },
  }));
}

async function loadAggregatedRows(
  recipientId: string,
): Promise<AggregatedRow[]> {
  const result = await db.execute(sql<AggregatedRow>`
    SELECT
      kind,
      "sourceUnitId",
      array_agg("actorId" ORDER BY "createdAt" DESC) FILTER (WHERE "actorId" IS NOT NULL) AS "actorIds",
      count(*)::bigint AS count,
      max("createdAt") AS "latestAt",
      bool_and(read) AS "allRead",
      (array_agg(extra ORDER BY "createdAt" DESC))[1] AS extra
    FROM "Notification"
    WHERE "recipientId" = ${recipientId}::uuid
      AND kind IN (${AGGREGATABLE_KIND_LIST})
    GROUP BY kind, "sourceUnitId"
    ORDER BY "latestAt" DESC
  `);
  return result.rows as AggregatedRow[];
}

async function loadIndividualRows(
  recipientId: string,
): Promise<NotificationRow[]> {
  return await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        inArray(notifications.kind, NON_AGGREGATABLE_KINDS),
      ),
    )
    .orderBy(desc(notifications.createdAt));
}

async function countAggregatedUnread(recipientId: string): Promise<number> {
  const result = await db.execute<{ count: bigint }>(sql`
    SELECT count(*) AS count FROM (
      SELECT 1
      FROM "Notification"
      WHERE "recipientId" = ${recipientId}::uuid
        AND kind IN (${AGGREGATABLE_KIND_LIST})
        AND read = false
      GROUP BY kind, "sourceUnitId"
    ) sub
  `);

  return Number(result.rows[0]?.count ?? 0);
}

async function countIndividualUnread(recipientId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        inArray(notifications.kind, NON_AGGREGATABLE_KINDS),
        eq(notifications.read, false),
      ),
    );

  return rows[0]?.count ?? 0;
}

export async function createNotification(input: {
  recipientId: string;
  actorId: string | null;
  kind: string;
  sourceUnitId: string;
  extra: unknown;
}): Promise<NotificationRow> {
  const [notification] = await db
    .insert(notifications)
    .values(input)
    .returning();
  if (!notification) throw new Error("Notification insert returned no row");
  return notification;
}

export async function findSystemEmailDuplicate(input: {
  recipientId: string;
  kind: string;
  sourceUnitId: string;
  actorId: string;
  since: Date;
}): Promise<NotificationRow | null> {
  const [row] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, input.recipientId),
        eq(notifications.kind, input.kind),
        eq(notifications.sourceUnitId, input.sourceUnitId),
        eq(notifications.actorId, input.actorId),
        sql`${notifications.createdAt} >= ${input.since}`,
        sql`${notifications.extra}->>'kind' = ${input.kind}`,
        sql`${notifications.extra}->'payload'->>'actorUserId' = ${input.actorId}`,
        sql`${notifications.extra}->'payload'->>'sourceUnitId' = ${input.sourceUnitId}`,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1);

  return row ?? null;
}

export async function refreshNotification(input: {
  id: string;
  createdAt: Date;
  extra: unknown;
}): Promise<NotificationRow> {
  const [row] = await db
    .update(notifications)
    .set({
      createdAt: input.createdAt,
      read: false,
      readAt: null,
      extra: input.extra,
    })
    .where(eq(notifications.id, input.id))
    .returning();
  if (!row) throw new Error("Notification refresh returned no row");
  return row;
}

export async function getNotifications(
  recipientId: string,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;

  const [aggregated, individual] = await Promise.all([
    loadAggregatedRows(recipientId),
    loadIndividualRows(recipientId),
  ]);

  const items = mapToAggregatedItems(aggregated, individual);

  items.sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
  );

  const total = items.length;
  const paged = items.slice(offset, offset + limit);

  return { items: paged, total, page, limit };
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  const [aggregatedCount, individualCount] = await Promise.all([
    countAggregatedUnread(recipientId),
    countIndividualUnread(recipientId),
  ]);
  return aggregatedCount + individualCount;
}

export async function markAsRead(
  recipientId: string,
  kind: string,
  sourceUnitId: string,
) {
  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        eq(notifications.kind, kind),
        eq(notifications.sourceUnitId, sourceUnitId),
        eq(notifications.read, false),
      ),
    );
}

export async function markAllAsRead(recipientId: string) {
  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        eq(notifications.read, false),
      ),
    );
}

export async function deleteNotification(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);
  if (!notification || notification.recipientId !== userId) return false;

  await db.delete(notifications).where(eq(notifications.id, notificationId));
  return true;
}

// Re-export the predicate for callers that import via this service.
export { isAggregatable };
