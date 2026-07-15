import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	pgEnum,
	primaryKey,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { NotificationKindValues, toEnumValues } from "./contract-values";
import {
	createCreatedAtColumn,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile, unit } from "./core";

export const notificationKind = pgEnum("notification_kind", toEnumValues(NotificationKindValues));
export const notificationEmailStatus = pgEnum("notification_email_status", [
	"not_requested",
	"pending",
	"sent",
	"failed",
]);

export const notification = pgTable(
	"notification",
	{
		id: createUuidv7PrimaryKey(),
		recipientProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		actorProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		kind: notificationKind().notNull(),
		subjectUnitId: uuid().references(() => unit.id, { onDelete: "set null" }),
		payload: createJsonObjectColumn(),
		dedupeKey: text(),
		inAppVisible: boolean().default(true).notNull(),
		readAt: createTimestampMsColumn(),
		emailStatus: notificationEmailStatus().default("not_requested").notNull(),
		emailedAt: createTimestampMsColumn(),
		emailError: text(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("notification_recipient_dedupe_key")
			.on(table.recipientProfileId, table.dedupeKey)
			.where(sql`${table.dedupeKey} is not null`),
		index("notification_recipient_created_at_idx")
			.on(table.recipientProfileId, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.inAppVisible}`),
		index("notification_recipient_unread_idx")
			.on(table.recipientProfileId, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.inAppVisible} and ${table.readAt} is null`),
		index("notification_actor_idx").on(table.actorProfileId),
		index("notification_subject_unit_idx").on(table.subjectUnitId),
		check(
			"notification_not_self_check",
			sql`${table.actorProfileId} is null or ${table.actorProfileId} <> ${table.recipientProfileId}`,
		),
		check(
			"notification_read_at_check",
			sql`${table.readAt} is null or ${table.readAt} >= ${table.createdAt}`,
		),
		check(
			"notification_email_state_check",
			sql`(${table.emailStatus} = 'sent'::notification_email_status and ${table.emailedAt} is not null and ${table.emailError} is null) or (${table.emailStatus} = 'failed'::notification_email_status and ${table.emailedAt} is null and nullif(btrim(${table.emailError}), '') is not null) or (${table.emailStatus} in ('not_requested', 'pending') and ${table.emailedAt} is null and ${table.emailError} is null)`,
		),
		createJsonObjectConstraint("notification_payload_json_object_check", table.payload),
	],
);

export const notificationPreference = pgTable(
	"notification_preference",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		kind: notificationKind().notNull(),
		inApp: boolean().default(true).notNull(),
		email: boolean().default(true).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.kind] }),
		index("notification_preference_kind_idx").on(table.kind),
	],
);

export const conversation = pgTable(
	"conversation",
	{
		id: createUuidv7PrimaryKey(),
		participantLowProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		participantHighProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("conversation_participant_pair_key").on(
			table.participantLowProfileId,
			table.participantHighProfileId,
		),
		index("conversation_low_profile_idx").on(table.participantLowProfileId),
		index("conversation_high_profile_idx").on(table.participantHighProfileId),
		check(
			"conversation_participant_order_check",
			sql`${table.participantLowProfileId} < ${table.participantHighProfileId}`,
		),
	],
);

export const message = pgTable(
	"message",
	{
		id: createUuidv7PrimaryKey(),
		conversationId: uuid()
			.notNull()
			.references(() => conversation.id, { onDelete: "cascade" }),
		senderProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		content: text(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("message_conversation_created_at_idx").on(
			table.conversationId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("message_sender_created_at_idx").on(
			table.senderProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check(
			"message_content_state_check",
			sql`(${table.deletedAt} is null and nullif(btrim(${table.content}), '') is not null) or (${table.deletedAt} is not null and ${table.content} is null)`,
		),
		check(
			"message_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);

export const conversationRead = pgTable(
	"conversation_read",
	{
		conversationId: uuid()
			.notNull()
			.references(() => conversation.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		lastReadMessageId: uuid().references(() => message.id, { onDelete: "set null" }),
		readAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.conversationId, table.profileId] }),
		index("conversation_read_profile_idx").on(table.profileId),
		index("conversation_read_last_message_idx").on(table.lastReadMessageId),
	],
);
