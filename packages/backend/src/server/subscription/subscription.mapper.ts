import type {
  SubscriptionDTO,
  UserSubscriptionListEntryDTO,
} from "@rezics/contract";
import type { Subscription, UserSubscriptionListEntry } from "../db/schema";

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

export function mapUserSubscriptionListEntryToDTO(
  row: typeof UserSubscriptionListEntry.$inferSelect & {
    subscribedSlug?: string | null;
    subscribedTitle?: string | null;
  },
): UserSubscriptionListEntryDTO {
  return {
    id: row.id,
    userUnitId: row.userUnitId,
    subscribedUnitId: row.subscribedUnitId,
    subscribedType: row.subscribedType,
    subscribedSlug: row.subscribedSlug ?? null,
    subscribedTitle: row.subscribedTitle ?? null,
    position: row.position,
    pinned: row.pinned,
    state: row.state,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
