import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { Unit } from "./catalog";
import { FeedbackType, ModerationTargetKind } from "./enums";

export const Feedback = pgTable(
  "Feedback",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid().notNull(),
    url: text(),
    content: text().notNull(),
    type: FeedbackType().default("REPORT").notNull(),
    resolved: boolean().default(false).notNull(),
    resolvedAt: timestamp({ precision: 3 }),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
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

export const Subscription = pgTable(
  "Subscription",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    subscriberUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    subscribedUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    channels: text().array(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
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
