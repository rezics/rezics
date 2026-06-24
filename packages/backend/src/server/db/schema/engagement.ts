import { feedbackTypeValues } from "@rezics/contract";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  createdAt,
  nullableTimestamp,
  textArray,
  timestampMs,
  updatedAt,
  uuidv7PrimaryKey,
} from "./columns";
import { ModerationTargetKind } from "./moderation";
import { Unit, UnitType } from "./unit";

export const FeedbackType = pgEnum("FeedbackType", feedbackTypeValues);

export const Feedback = pgTable(
  "Feedback",
  {
    id: uuidv7PrimaryKey(),
    userId: uuid().notNull(),
    url: text(),
    content: text().notNull(),
    type: FeedbackType().default("REPORT").notNull(),
    resolved: boolean().default(false).notNull(),
    resolvedAt: nullableTimestamp(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    addressedUnitId: uuid(),
    targetId: varchar({ length: 128 }),
    targetKind: ModerationTargetKind(),
  },
  (table) => [
    index("Feedback_addressedUnitId_idx").using(
      "btree",
      table.addressedUnitId.asc().nullsLast(),
    ),
    index("Feedback_resolved_idx").using(
      "btree",
      table.resolved.asc().nullsLast(),
    ),
    index("Feedback_targetKind_targetId_idx").using(
      "btree",
      table.targetKind.asc().nullsLast(),
      table.targetId.asc().nullsLast(),
    ),
    index("Feedback_type_idx").using("btree", table.type.asc().nullsLast()),
    index("Feedback_userId_idx").using("btree", table.userId.asc().nullsLast()),
  ],
);

/**
 * Generic attention edge from a subscriber Unit to an explicitly subscribed
 * Unit. This is a subscription endpoint, not Unit.targetUnitId.
 */
export const Subscription = pgTable(
  "Subscription",
  {
    id: uuidv7PrimaryKey(),
    subscriberUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    subscribedUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    /**
     * Dot-namespaced event filter using wildcard tiers: "*", "<category>.*",
     * and "<category>.<event>". Fan-out resolves these with GIN-indexable array
     * containment checks.
     */
    channels: textArray(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("subscription_channels_gin").using(
      "gin",
      table.channels.asc().nullsLast(),
    ),
    index("Subscription_subscribedUnitId_idx").using(
      "btree",
      table.subscribedUnitId.asc().nullsLast(),
    ),
    index("Subscription_subscriberUnitId_idx").using(
      "btree",
      table.subscriberUnitId.asc().nullsLast(),
    ),
    uniqueIndex("Subscription_subscriberUnitId_subscribedUnitId_key").using(
      "btree",
      table.subscriberUnitId.asc().nullsLast(),
      table.subscribedUnitId.asc().nullsLast(),
    ),
  ],
);

export const userSubscriptionListEntryStateStorageValues = [
  "ACTIVE",
  "REMOVED",
] as const;

export type UserSubscriptionListEntryStateStorage =
  (typeof userSubscriptionListEntryStateStorageValues)[number];

export const UserSubscriptionListEntryState = pgEnum(
  "UserSubscriptionListEntryState",
  userSubscriptionListEntryStateStorageValues,
);

/**
 * User-owned ordering metadata for subscription lists. Subscription remains the
 * attention/notification edge; this row controls list/sidebar presence,
 * pinning, and recovery state for any subscribable target Unit.
 */
export const UserSubscriptionListEntry = pgTable(
  "UserSubscriptionListEntry",
  {
    id: uuidv7PrimaryKey(),
    userUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    subscribedUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    subscribedType: UnitType().notNull(),
    position: varchar({ length: 64 }).notNull(), // Fractional Indexing
    pinned: boolean().default(false).notNull(),
    state: UserSubscriptionListEntryState().default("ACTIVE").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("UserSubscriptionListEntry_user_state_type_order_idx").using(
      "btree",
      table.userUnitId.asc().nullsLast(),
      table.state.asc().nullsLast(),
      table.subscribedType.asc().nullsLast(),
      table.pinned.desc().nullsLast(),
      table.position.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("UserSubscriptionListEntry_subscribedUnitId_idx").using(
      "btree",
      table.subscribedUnitId.asc().nullsLast(),
    ),
    uniqueIndex("UserSubscriptionListEntry_user_subscribed_key").using(
      "btree",
      table.userUnitId.asc().nullsLast(),
      table.subscribedUnitId.asc().nullsLast(),
    ),
  ],
);
