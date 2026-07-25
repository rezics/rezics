import { StatusCodes } from "http-status-codes";
import { Check } from "@sinclair/typebox/value";
import { and, asc, count, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Elysia, { t } from "elysia";
import { toUiLocale } from "@rezics/i18n";

import session from "../../auth/session";
import { database } from "../../database";
import { primaryUnitTitle } from "../../units/localization";
import {
	notification,
	profile as profileTable,
	notificationPreference,
	profilePreference,
} from "../../database/schema";
import { emailIntentDeliveryEnabled } from "../../email/policy";
import i18n from "../../i18n";
import { DefaultStoredUiLocale } from "../../database/schema/contract-values";
import { parseJsonCursor } from "../../pagination";
import { notificationTranslationKey } from "../../notifications/service";
import { toApiErrorResponse } from "../schema/response";
import { InvalidNotificationCursor, NotificationNotFound } from "./errors";
import {
	DirectMessageNotificationPayload,
	ModerationNotificationPayload,
	NotificationCursorQuery,
	NotificationListResponse,
	NotificationParams,
	NotificationPreferencesResponse,
	ReadNotificationsBody,
	RealmNotificationPayload,
	ReplaceNotificationPreferencesBody,
	SystemNotificationPayload,
	UnreadCountResponse,
} from "./schema";

const NotificationCursor = t.Object(
	{
		v: t.Literal(1),
		createdAt: t.String(),
		id: t.String({ minLength: 1 }),
		unreadOnly: t.Boolean(),
	},
	{ additionalProperties: false },
);
type NotificationCursor = typeof NotificationCursor.static;

const preferenceKinds = [
	"reply",
	"new_follower",
	"direct_message",
	"moderation",
	"realm",
	"system",
] as const;
const notificationEmailDeliveryEnabled = emailIntentDeliveryEnabled("notification");

function encodeCursor(cursor: NotificationCursor) {
	return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string | undefined, unreadOnly: boolean) {
	if (!value) return undefined;
	try {
		const parsed = parseJsonCursor(value, NotificationCursor);
		if (
			parsed.unreadOnly !== unreadOnly ||
			Number.isNaN(Date.parse(parsed.createdAt)) ||
			!parsed.id
		)
			throw new InvalidNotificationCursor();
		return {
			...parsed,
			date: new Date(parsed.createdAt),
		};
	} catch {
		throw new InvalidNotificationCursor();
	}
}

function presentNotificationPayload(
	kind: (typeof notification.$inferSelect)["kind"],
	payload: (typeof notification.$inferSelect)["payload"],
) {
	switch (kind) {
		case "reply":
		case "new_follower":
			if (payload !== null) throw new Error(`${kind} notification has an invalid payload`);
			return { kind, payload };
		case "direct_message":
			if (!Check(DirectMessageNotificationPayload, payload))
				throw new Error("Direct-message notification has an invalid payload");
			return { kind, payload };
		case "moderation":
			if (!Check(ModerationNotificationPayload, payload))
				throw new Error("Moderation notification has an invalid payload");
			return { kind, payload };
		case "realm":
			if (!Check(RealmNotificationPayload, payload))
				throw new Error("Realm notification has an invalid payload");
			return { kind, payload };
		case "system":
			if (!Check(SystemNotificationPayload, payload))
				throw new Error("System notification has an invalid payload");
			return { kind, payload };
	}
}

export default new Elysia({ prefix: "/notifications" })
	.use(session)
	.use(i18n)
	.get(
		"",
		async ({ i18n, profile, query }) => {
			const unreadOnly = Boolean(query.unreadOnly);
			const direction = query.direction ?? "before";
			const cursor = decodeCursor(query.cursor, unreadOnly);
			const boundary = cursor;
			const [preference] = await database
				.select({ interfaceLocale: profilePreference.interfaceLocale })
				.from(profilePreference)
				.where(eq(profilePreference.profileId, profile.unitId))
				.limit(1);
			const { t } = await i18n.getTranslation("notifications", [
				toUiLocale(preference?.interfaceLocale ?? DefaultStoredUiLocale),
			]);
			const actor = alias(profileTable, "notification_actor");
			const tupleCondition = boundary
				? direction === "after"
					? or(
							gt(notification.createdAt, boundary.date),
							and(
								eq(notification.createdAt, boundary.date),
								gt(notification.id, boundary.id),
							),
						)
					: or(
							lt(notification.createdAt, boundary.date),
							and(
								eq(notification.createdAt, boundary.date),
								lt(notification.id, boundary.id),
							),
						)
				: undefined;
			const limit = query.limit ?? 30;
			const candidates = await database
				.select({
					id: notification.id,
					kind: notification.kind,
					actorProfileId: notification.actorProfileId,
					actorName: primaryUnitTitle(actor.id),
					subjectUnitId: notification.subjectUnitId,
					payload: notification.payload,
					readAt: notification.readAt,
					createdAt: notification.createdAt,
				})
				.from(notification)
				.leftJoin(actor, eq(actor.id, notification.actorProfileId))
				.where(
					and(
						eq(notification.recipientProfileId, profile.unitId),
						eq(notification.inAppVisible, true),
						unreadOnly ? isNull(notification.readAt) : undefined,
						tupleCondition,
					),
				)
				.orderBy(
					direction === "after"
						? asc(notification.createdAt)
						: desc(notification.createdAt),
					direction === "after" ? asc(notification.id) : desc(notification.id),
				)
				.limit(limit + 1);
			const items = candidates.slice(0, limit).map((item) => {
				const presented = presentNotificationPayload(item.kind, item.payload);
				return {
					...item,
					...presented,
					...t[notificationTranslationKey(presented.kind, presented.payload)],
				};
			});
			const [unread] = await database
				.select({ value: count() })
				.from(notification)
				.where(
					and(
						eq(notification.recipientProfileId, profile.unitId),
						eq(notification.inAppVisible, true),
						isNull(notification.readAt),
					),
				);
			const newest = direction === "after" ? items.at(-1) : items[0];
			const last = items.at(-1);
			return {
				items,
				nextCursor:
					candidates.length > limit && last
						? encodeCursor({
								v: 1,
								createdAt: last.createdAt.toISOString(),
								id: last.id,
								unreadOnly,
							})
						: null,
				pollCursor: newest
					? encodeCursor({
							v: 1,
							createdAt: newest.createdAt.toISOString(),
							id: newest.id,
							unreadOnly,
						})
					: (query.cursor ?? null),
				unreadCount: unread?.value ?? 0,
			};
		},
		{
			access: "notification:read",
			query: NotificationCursorQuery,
			response: {
				[StatusCodes.OK]: NotificationListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidNotificationCursor"]),
			},
			detail: { summary: "Poll notifications with a cursor", tags: ["Notifications"] },
		},
	)
	.get(
		"/unread-count",
		async ({ profile }) => {
			const [row] = await database
				.select({ value: count() })
				.from(notification)
				.where(
					and(
						eq(notification.recipientProfileId, profile.unitId),
						eq(notification.inAppVisible, true),
						isNull(notification.readAt),
					),
				);
			return { count: row?.value ?? 0 };
		},
		{
			access: "notification:read",
			response: { [StatusCodes.OK]: UnreadCountResponse },
			detail: { summary: "Get unread notification count", tags: ["Notifications"] },
		},
	)
	.put(
		"/read-all",
		async ({ profile, authorization, body }) => {
			await authorization.unit.ensureCanUpdate(profile.unitId, [
				["notification-preferences"],
			]);
			const through = decodeCursor(body.through, false);
			const boundary = through;
			await database
				.update(notification)
				.set({ readAt: new Date() })
				.where(
					and(
						eq(notification.recipientProfileId, profile.unitId),
						eq(notification.inAppVisible, true),
						isNull(notification.readAt),
						boundary
							? or(
									lt(notification.createdAt, boundary.date),
									and(
										eq(notification.createdAt, boundary.date),
										lt(notification.id, boundary.id),
									),
									eq(notification.id, boundary.id),
								)
							: undefined,
					),
				);
			return { updated: true };
		},
		{
			access: "write:notification:write",
			body: ReadNotificationsBody,
			response: {
				[StatusCodes.OK]: t.Object({ updated: t.Boolean() }),
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidNotificationCursor"]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitProtected"]),
			},
			detail: { summary: "Mark notifications read", tags: ["Notifications"] },
		},
	)
	.put(
		"/:notificationId/read",
		async ({ profile, params }) => {
			const [updated] = await database
				.update(notification)
				.set({ readAt: new Date() })
				.where(
					and(
						eq(notification.id, params.notificationId),
						eq(notification.recipientProfileId, profile.unitId),
						eq(notification.inAppVisible, true),
					),
				)
				.returning({ id: notification.id });
			if (!updated) throw new NotificationNotFound();
			return { updated: true };
		},
		{
			access: "write:notification:write",
			params: NotificationParams,
			response: {
				[StatusCodes.OK]: t.Object({ updated: t.Boolean() }),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["NotificationNotFound"]),
			},
			detail: { summary: "Mark one notification read", tags: ["Notifications"] },
		},
	)
	.get(
		"/preferences",
		async ({ profile }) => {
			const rows = await database
				.select()
				.from(notificationPreference)
				.where(eq(notificationPreference.profileId, profile.unitId));
			return {
				items: preferenceKinds.map((kind) => ({
					kind,
					inApp: rows.find((row) => row.kind === kind)?.inApp ?? true,
					email:
						notificationEmailDeliveryEnabled &&
						(rows.find((row) => row.kind === kind)?.email ?? true),
				})),
			};
		},
		{
			access: "notification:read",
			response: { [StatusCodes.OK]: NotificationPreferencesResponse },
			detail: { summary: "Get notification preferences", tags: ["Notifications"] },
		},
	)
	.put(
		"/preferences",
		async ({ profile, body }) => {
			await database.transaction(async (tx) => {
				for (const item of body.items)
					await tx
						.insert(notificationPreference)
						.values({
							profileId: profile.unitId,
							...item,
							email: notificationEmailDeliveryEnabled && item.email,
						})
						.onConflictDoUpdate({
							target: [notificationPreference.profileId, notificationPreference.kind],
							set: {
								inApp: item.inApp,
								email: notificationEmailDeliveryEnabled && item.email,
							},
						});
			});
			const rows = new Map<string, (typeof body.items)[number]>(
				body.items.map((item) => [
					item.kind,
					{
						...item,
						email: notificationEmailDeliveryEnabled && item.email,
					},
				]),
			);
			return {
				items: preferenceKinds.map(
					(kind) => rows.get(kind) ?? { kind, inApp: true, email: false },
				),
			};
		},
		{
			access: "write:notification:write",
			body: ReplaceNotificationPreferencesBody,
			response: { [StatusCodes.OK]: NotificationPreferencesResponse },
			detail: { summary: "Update notification preferences", tags: ["Notifications"] },
		},
	);
