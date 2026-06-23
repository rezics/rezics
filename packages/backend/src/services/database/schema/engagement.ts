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
  updatedAt,
  uuidv7PrimaryKey,
} from "./columns.ts";
import { User } from "./identity.ts";
import { ModerationTargetKind } from "./moderation.ts";
import { Unit, UnitType } from "./unit.ts";

// Inlined from @rezics/contract
// 从 @rezics/contract 内联
const feedbackTypeValues = [
  "REPORT",
  "BUG",
  "FEATURE",
  "OTHER",
] as const;

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
 * Generic attention edge from a subscriber Unit to an explicitly subscribed Unit.
 * 从订阅者 Unit 到被显式订阅 Unit 的通用关注边。
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
     * Dot-namespaced event filter using wildcard tiers.
     * 使用通配符层级的点命名空间事件过滤器。
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
 * User-owned ordering metadata for subscription lists.
 * 用户拥有的订阅列表排序元数据。
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

/**
 * Generic reaction edge from a user to any target entity.
 * 从用户到任意目标实体的通用反应边。
 */
export const Reaction = pgTable(
  "Reaction",
  {
    id: uuidv7PrimaryKey(),
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    targetId: uuid().notNull(),
    reaction: varchar({ length: 64 }).notNull(),
    contextUnitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("Reaction_userId_targetId_reaction_key").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.targetId.asc().nullsLast(),
      table.reaction.asc().nullsLast(),
    ),
    index("Reaction_targetId_reaction_idx").using(
      "btree",
      table.targetId.asc().nullsLast(),
      table.reaction.asc().nullsLast(),
    ),
    index("Reaction_userId_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
    ),
  ],
);
