import type { SubscriptionDTO } from "@rezics/contract";
import type { Subscription } from "#/prisma/client";

export function mapSubscriptionToDTO(row: Subscription): SubscriptionDTO {
  return {
    id: row.id,
    subscriberUnitId: row.subscriberUnitId,
    targetUnitId: row.targetUnitId,
    channels: row.channels,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
