import type { Subscription, Unit } from "../db/schema";

export type SubscriptionWithTarget = typeof Subscription.$inferSelect & {
  subscribedUnit?: Pick<
    typeof Unit.$inferSelect,
    "id" | "type" | "slug"
  > | null;
};
