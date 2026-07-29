import { inArray, sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	integer,
	pgEnum,
	primaryKey,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	type DeliveryLocale,
	DeliveryLocaleValues,
	NotificationKindValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile, unit, unitFollow } from "./core";

export const notificationKind = pgEnum("notification_kind", toEnumValues(NotificationKindValues));
export const notificationEmailStatus = pgEnum("notification_email_status", [
	"not_requested",
	"pending",
	"sent",
	"failed",
]);
export const emailOutboxKind = pgEnum("email_outbox_kind", [
	"verify_email",
	"reset_password",
	"notification",
]);
export const emailOutboxStatus = pgEnum("email_outbox_status", [
	"pending",
	"processing",
	"accepted",
	"failed",
]);
export const emailProviderStatus = pgEnum("email_provider_status", [
	"logged",
	"queued",
	"delivered",
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
		/** @UNIT_LOCALIZATION_EXEMPT Machine diagnostic: raw delivery failure detail for operators, never display copy. */
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

/**
 * Durable email intent. Authentication intents carry their immutable recipient,
 * locale, and action URL. Notification intents point at the authoritative
 * notification row and resolve its recipient and localized copy when claimed.
 */
export const emailOutbox = pgTable(
	"email_outbox",
	{
		id: createUuidv7PrimaryKey(),
		kind: emailOutboxKind().notNull(),
		notificationId: uuid().references(() => notification.id, { onDelete: "cascade" }),
		recipientEmail: text(),
		locale: text().$type<DeliveryLocale>(),
		actionUrl: text(),
		status: emailOutboxStatus().default("pending").notNull(),
		attemptCount: integer().default(0).notNull(),
		availableAt: createTimestampMsColumn().defaultNow().notNull(),
		leaseExpiresAt: createTimestampMsColumn(),
		acceptedAt: createTimestampMsColumn(),
		failedAt: createTimestampMsColumn(),
		providerMessageId: text(),
		providerStatus: emailProviderStatus(),
		/** @UNIT_LOCALIZATION_EXEMPT Machine diagnostic for operators; never display copy. */
		lastError: text(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("email_outbox_notification_idx")
			.on(table.notificationId)
			.where(sql`${table.notificationId} is not null`),
		uniqueIndex("email_outbox_provider_message_idx")
			.on(table.providerMessageId)
			.where(sql`${table.providerMessageId} is not null`),
		index("email_outbox_pending_idx")
			.on(table.availableAt, table.createdAt)
			.where(sql`${table.status} = 'pending'::email_outbox_status`),
		index("email_outbox_processing_lease_idx")
			.on(table.leaseExpiresAt)
			.where(sql`${table.status} = 'processing'::email_outbox_status`),
		check("email_outbox_attempt_count_check", sql`${table.attemptCount} >= 0`),
		check(
			"email_outbox_intent_check",
			sql`(
				${table.kind} = 'notification'::email_outbox_kind
				and ${table.notificationId} is not null
				and ${table.recipientEmail} is null
				and ${table.locale} is null
				and ${table.actionUrl} is null
			) or (
				${table.kind} in (
					'verify_email'::email_outbox_kind,
					'reset_password'::email_outbox_kind
				)
				and ${table.notificationId} is null
				and (
					(
						${table.status} in (
							'pending'::email_outbox_status,
							'processing'::email_outbox_status
						)
						and nullif(btrim(${table.recipientEmail}), '') is not null
						and nullif(btrim(${table.actionUrl}), '') is not null
						and ${inArray(table.locale, DeliveryLocaleValues)}
					) or (
						${table.status} in (
							'accepted'::email_outbox_status,
							'failed'::email_outbox_status
						)
						and ${table.recipientEmail} is null
						and ${table.locale} is null
						and ${table.actionUrl} is null
					)
				)
			)`,
		),
		check(
			"email_outbox_state_check",
			sql`(
				${table.status} = 'pending'::email_outbox_status
				and ${table.leaseExpiresAt} is null
				and ${table.acceptedAt} is null
				and ${table.failedAt} is null
				and ${table.providerMessageId} is null
				and ${table.providerStatus} is null
			) or (
				${table.status} = 'processing'::email_outbox_status
				and ${table.leaseExpiresAt} is not null
				and ${table.acceptedAt} is null
				and ${table.failedAt} is null
				and ${table.providerMessageId} is null
				and ${table.providerStatus} is null
				and ${table.lastError} is null
			) or (
				${table.status} = 'accepted'::email_outbox_status
				and ${table.leaseExpiresAt} is null
				and ${table.acceptedAt} is not null
				and ${table.failedAt} is null
				and ${table.providerStatus} is not null
				and (
					${table.providerStatus} = 'logged'::email_provider_status
					or nullif(btrim(${table.providerMessageId}), '') is not null
				)
				and ${table.lastError} is null
			) or (
				${table.status} = 'failed'::email_outbox_status
				and ${table.leaseExpiresAt} is null
				and ${table.acceptedAt} is null
				and ${table.failedAt} is not null
				and ${table.providerMessageId} is null
				and ${table.providerStatus} is null
				and nullif(btrim(${table.lastError}), '') is not null
			)`,
		),
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

/**
 * Per-follow in-app delivery preference.
 *
 * A missing row keeps the platform default (`inApp = true`), so follow creation
 * remains independent from notification settings. The composite foreign key
 * makes the preference lifecycle follow the underlying relation.
 */
export const unitFollowNotificationPreference = pgTable(
	"unit_follow_notification_preference",
	{
		followerProfileId: uuid().notNull(),
		unitId: uuid().notNull(),
		inApp: boolean().default(true).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.followerProfileId, table.unitId] }),
		foreignKey({
			name: "unit_follow_notification_preference_follow_fkey",
			columns: [table.followerProfileId, table.unitId],
			foreignColumns: [unitFollow.followerProfileId, unitFollow.unitId],
		}).onDelete("cascade"),
		index("unit_follow_notification_preference_enabled_unit_idx")
			.on(table.unitId, table.followerProfileId)
			.where(sql`${table.inApp}`),
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
		/** @UNIT_LOCALIZATION_EXEMPT Authored snapshot: original direct message; translation would alter the message. */
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
