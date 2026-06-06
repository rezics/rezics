import type { NotificationItem } from "@rezics/contract";
import type { NotificationRow } from "../db/schema";
import { buildNotificationTarget } from "./notification.target";

type AggregatedRow = {
  kind: string;
  sourceUnitId: string;
  actorIds: string[];
  count: bigint;
  latestAt: Date;
  allRead: boolean;
  extra: unknown;
};

export function mapToAggregatedItems(
  aggregated: AggregatedRow[],
  individual: NotificationRow[],
): NotificationItem[] {
  const items: NotificationItem[] = [];

  for (const row of aggregated) {
    items.push({
      id: `${row.kind}:${row.sourceUnitId}`,
      kind: row.kind,
      sourceUnitId: row.sourceUnitId,
      actorIds: row.actorIds ?? [],
      count: Number(row.count),
      extra: row.extra,
      read: row.allRead,
      latestAt: row.latestAt.toISOString(),
      target: buildNotificationTarget(row.kind, row.extra),
    });
  }

  for (const row of individual) {
    items.push({
      id: row.id,
      kind: row.kind,
      sourceUnitId: row.sourceUnitId,
      actorIds: row.actorId ? [row.actorId] : [],
      count: 1,
      extra: row.extra,
      read: row.read,
      latestAt: row.createdAt.toISOString(),
      target: buildNotificationTarget(row.kind, row.extra),
    });
  }

  return items;
}

export function mapNotificationToRawEvent(notification: NotificationRow) {
  return {
    id: notification.id,
    kind: notification.kind,
    sourceUnitId: notification.sourceUnitId,
    actorId: notification.actorId,
    extra: notification.extra,
    createdAt: notification.createdAt.toISOString(),
  };
}
