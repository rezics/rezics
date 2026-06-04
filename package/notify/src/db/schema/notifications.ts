import { sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";

export const notifications = p.pgTable(
  "Notification",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    recipientId: p.uuid("recipientId").notNull(),
    actorId: p.uuid("actorId"),
    kind: p.varchar("kind", { length: 64 }).notNull(),
    sourceUnitId: p.uuid("sourceUnitId").notNull(),
    extra: p.jsonb("extra"),
    read: p.boolean("read").notNull().default(false),
    readAt: p.timestamp("readAt", { precision: 3 }),
    createdAt: p
      .timestamp("createdAt", { precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    p
      .index("Notification_recipientId_read_idx")
      .on(table.recipientId, table.read),
    p
      .index("Notification_recipientId_kind_sourceUnitId_idx")
      .on(table.recipientId, table.kind, table.sourceUnitId),
    p
      .index("Notification_recipientId_createdAt_idx")
      .on(table.recipientId, table.createdAt.desc()),
  ],
);

export const conversations = p.pgTable(
  "Conversation",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    participantA: p.uuid("participantA").notNull(),
    participantB: p.uuid("participantB").notNull(),
    createdAt: p
      .timestamp("createdAt", { precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: p.timestamp("updatedAt", { precision: 3 }).notNull(),
  },
  (table) => [
    p
      .uniqueIndex("Conversation_participantA_participantB_key")
      .on(table.participantA, table.participantB),
    p.index("Conversation_participantA_idx").on(table.participantA),
    p.index("Conversation_participantB_idx").on(table.participantB),
  ],
);

export const messages = p.pgTable(
  "Message",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    conversationId: p.uuid("conversationId").notNull(),
    senderId: p.uuid("senderId").notNull(),
    content: p.text("content").notNull(),
    readAt: p.timestamp("readAt", { precision: 3 }),
    createdAt: p
      .timestamp("createdAt", { precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    p
      .index("Message_conversationId_createdAt_idx")
      .on(table.conversationId, table.createdAt.desc()),
    p
      .foreignKey({
        columns: [table.conversationId],
        foreignColumns: [conversations.id],
        name: "Message_conversationId_fkey",
      })
      .onDelete("restrict")
      .onUpdate("cascade"),
  ],
);

export const conversationBlocks = p.pgTable(
  "ConversationBlock",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    blockerId: p.uuid("blockerId").notNull(),
    blockedId: p.uuid("blockedId").notNull(),
    createdAt: p
      .timestamp("createdAt", { precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    p
      .uniqueIndex("ConversationBlock_blockerId_blockedId_key")
      .on(table.blockerId, table.blockedId),
    p.index("ConversationBlock_blockerId_idx").on(table.blockerId),
    p.index("ConversationBlock_blockedId_idx").on(table.blockedId),
  ],
);

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;
export type ConversationRow = typeof conversations.$inferSelect;
export type NewConversationRow = typeof conversations.$inferInsert;
export type MessageRow = typeof messages.$inferSelect;
export type NewMessageRow = typeof messages.$inferInsert;
export type ConversationBlockRow = typeof conversationBlocks.$inferSelect;
export type NewConversationBlockRow = typeof conversationBlocks.$inferInsert;
