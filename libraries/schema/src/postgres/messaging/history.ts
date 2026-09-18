import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { conversation, message } from "./communication";
import { users } from "../identity/auth";
import { entityIdentity } from "../catalog/identity";
import { mediaRepresentation } from "../media/indexing.generated";

export const conversationMember = pgTable(
	"conversation_member",
	{
		conversationId: uuid()
			.notNull()
			.references(() => conversation.id, { onDelete: "cascade" }),
		userId: uuid()
			.notNull()
			.references(() => users.id),
		entityId: uuid()
			.notNull()
			.references(() => entityIdentity.id),
		role: text().notNull(),
		joinedAt: timestamp({ withTimezone: true, precision: 3 }).notNull(),
		historyFrom: timestamp({ withTimezone: true, precision: 3 }).notNull(),
		leftAt: timestamp({ withTimezone: true, precision: 3 }),
		revision: bigint({ mode: "number" }).notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.conversationId, t.userId] }),
		index("conversation_member_user").on(t.userId, t.conversationId),
		check(
			"conversation_member_role",
			sql`${t.role} in ('member','moderator','owner') and ${t.revision}>0`,
		),
	],
);

/** @alpha Closed message versions only: the first write does not duplicate every message body. */
export const messageRevision = pgTable(
	"message_revision",
	{
		conversationId: uuid().notNull(),
		messageId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		content: text(),
		validFrom: timestamp({ withTimezone: true, precision: 3 }).notNull(),
		closedAt: timestamp({ withTimezone: true, precision: 3 }).notNull(),
		erasedAt: timestamp({ withTimezone: true, precision: 3 }),
	},
	(t) => [
		primaryKey({ columns: [t.conversationId, t.messageId, t.revision] }),
		foreignKey({
			columns: [t.messageId, t.conversationId],
			foreignColumns: [message.id, message.conversationId],
		}).onDelete("cascade"),
		check(
			"message_revision_state",
			sql`${t.revision}>0 and ((${t.erasedAt} is null and ${t.content} is not null) or (${t.erasedAt} is not null and ${t.content} is null))`,
		),
	],
);
export const messageAttachment = pgTable(
	"message_attachment",
	{
		conversationId: uuid().notNull(),
		messageId: uuid().notNull(),
		id: uuid().notNull(),
		representationId: uuid()
			.notNull()
			.references(() => mediaRepresentation.id),
		caption: text(),
	},
	(t) => [
		primaryKey({ columns: [t.conversationId, t.messageId, t.id] }),
		foreignKey({
			columns: [t.messageId, t.conversationId],
			foreignColumns: [message.id, message.conversationId],
		}).onDelete("cascade"),
	],
);
export const messageDeliveryReceipt = pgTable(
	"message_delivery_receipt",
	{
		conversationId: uuid().notNull(),
		messageId: uuid().notNull(),
		recipientUserId: uuid()
			.notNull()
			.references(() => users.id),
		deliveredAt: timestamp({ withTimezone: true, precision: 3 }),
		readAt: timestamp({ withTimezone: true, precision: 3 }),
	},
	(t) => [
		primaryKey({ columns: [t.conversationId, t.messageId, t.recipientUserId] }),
		foreignKey({
			columns: [t.messageId, t.conversationId],
			foreignColumns: [message.id, message.conversationId],
		}).onDelete("cascade"),
		check(
			"message_receipt_order",
			sql`${t.readAt} is null or (${t.deliveredAt} is not null and ${t.readAt}>=${t.deliveredAt})`,
		),
	],
);
