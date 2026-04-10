import { AGGREGATABLE_TYPES, type NotificationType } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { mapToAggregatedItems } from "./notification.mapper";

export async function getNotifications(
  recipientId: string,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;

  // Fetch aggregatable notifications grouped by (type, entityType, entityId)
  const aggregatableTypes = [...AGGREGATABLE_TYPES] as NotificationType[];

  const aggregated = await prisma.$queryRawUnsafe<
    {
      type: string;
      entityType: string;
      entityId: string;
      actorIds: string[];
      count: bigint;
      latestAt: Date;
      allRead: boolean;
      meta: unknown;
    }[]
  >(
    `
    SELECT
      type,
      "entityType",
      "entityId",
      array_agg("actorId" ORDER BY "createdAt" DESC) FILTER (WHERE "actorId" IS NOT NULL) AS "actorIds",
      count(*)::bigint AS count,
      max("createdAt") AS "latestAt",
      bool_and(read) AS "allRead",
      (array_agg(meta ORDER BY "createdAt" DESC))[1] AS meta
    FROM "Notification"
    WHERE "recipientId" = $1::uuid AND type = ANY($2::text[])
    GROUP BY type, "entityType", "entityId"
    ORDER BY "latestAt" DESC
    `,
    recipientId,
    aggregatableTypes,
  );

  // Fetch individual (non-aggregatable) notifications
  const nonAggregatableTypes = [
    "COMMENT",
    "MENTION",
    "SYSTEM",
    "INVITATION",
  ] as const;

  const individual = await prisma.notification.findMany({
    where: {
      recipientId,
      type: { in: [...nonAggregatableTypes] },
    },
    orderBy: { createdAt: "desc" },
  });

  const items = mapToAggregatedItems(aggregated, individual);

  // Sort all items by latestAt descending, then paginate
  items.sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
  );

  const total = items.length;
  const paged = items.slice(offset, offset + limit);

  return { items: paged, total, page, limit };
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  const aggregatableTypes = [...AGGREGATABLE_TYPES] as NotificationType[];

  // Count distinct aggregated groups with at least one unread
  const aggregatedResult = await prisma.$queryRawUnsafe<
    { count: bigint }[]
  >(
    `
    SELECT count(*) AS count FROM (
      SELECT 1
      FROM "Notification"
      WHERE "recipientId" = $1::uuid AND type = ANY($2::text[]) AND read = false
      GROUP BY type, "entityType", "entityId"
    ) sub
    `,
    recipientId,
    aggregatableTypes,
  );

  // Count individual unread notifications
  const individualCount = await prisma.notification.count({
    where: {
      recipientId,
      type: { in: ["COMMENT", "MENTION", "SYSTEM", "INVITATION"] },
      read: false,
    },
  });

  const aggregatedCount = Number(aggregatedResult[0]?.count ?? 0);
  return aggregatedCount + individualCount;
}

export async function markAsRead(
  recipientId: string,
  type: string,
  entityType: string,
  entityId: string,
) {
  await prisma.notification.updateMany({
    where: { recipientId, type: type as any, entityType, entityId, read: false },
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

export async function createNotification(data: {
  recipientId: string;
  actorId?: string | null;
  type: string;
  entityType: string;
  entityId: string;
  meta?: unknown;
}) {
  return prisma.notification.create({
    data: {
      recipientId: data.recipientId,
      actorId: data.actorId ?? null,
      type: data.type as any,
      entityType: data.entityType,
      entityId: data.entityId,
      meta: data.meta as any,
    },
  });
}
