import type { SubscriptionDTO } from "@rezics/contract";
import type { Subscription } from "#/prisma/client";

export function mapSubscriptionToDTO(row: Subscription): SubscriptionDTO {
  return {
    id: row.id,
    subscriberUnitId: row.subscriberUnitId,
    subscribedUnitId: row.subscribedUnitId,
    channels: row.channels,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
