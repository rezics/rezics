import type { SubscriptionDTO } from "@rezics/contract";
import type { Subscription } from "../db/schema";

export function mapSubscriptionToDTO(
  row: typeof Subscription.$inferSelect,
): SubscriptionDTO {
  return {
    id: row.id,
    subscriberUnitId: row.subscriberUnitId,
    subscribedUnitId: row.subscribedUnitId,
    channels: row.channels as string[],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
