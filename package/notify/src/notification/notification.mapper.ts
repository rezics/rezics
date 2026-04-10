import type { NotificationItem } from "@rezics/contract";
import type { Notification } from "#/prisma/client";

type AggregatedRow = {
  type: string;
  entityType: string;
  entityId: string;
  actorIds: string[];
  count: bigint;
  latestAt: Date;
  allRead: boolean;
  meta: unknown;
};

export function mapToAggregatedItems(
  aggregated: AggregatedRow[],
  individual: Notification[],
): NotificationItem[] {
  const items: NotificationItem[] = [];

  for (const row of aggregated) {
    items.push({
      id: `${row.type}:${row.entityType}:${row.entityId}`,
      type: row.type as NotificationItem["type"],
      entityType: row.entityType,
      entityId: row.entityId,
      actorIds: row.actorIds ?? [],
      count: Number(row.count),
      meta: row.meta,
      read: row.allRead,
      latestAt: row.latestAt.toISOString(),
    });
  }

  for (const row of individual) {
    items.push({
      id: row.id,
      type: row.type as NotificationItem["type"],
      entityType: row.entityType,
      entityId: row.entityId,
      actorIds: row.actorId ? [row.actorId] : [],
      count: 1,
      meta: row.meta,
      read: row.read,
      latestAt: row.createdAt.toISOString(),
    });
  }

  return items;
}

export function mapNotificationToRawEvent(notification: Notification) {
  return {
    id: notification.id,
    type: notification.type,
    actorId: notification.actorId,
    entityType: notification.entityType,
    entityId: notification.entityId,
    meta: notification.meta,
    createdAt: notification.createdAt.toISOString(),
  };
}
