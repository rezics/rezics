import { type Static, t } from "elysia";

import { NotificationKindValues } from "../../database/schema/contract-values";
import { DateTime, Uuid } from "../schema";

export const NotificationCursorQuery = t.Object({
	cursor: t.Optional(t.String({ maxLength: 512 })),
	direction: t.Optional(
		t.Union([t.Literal("before"), t.Literal("after")], { default: "before" }),
	),
	unreadOnly: t.Optional(t.Boolean({ default: false })),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
});
export type NotificationCursorQuery = Static<typeof NotificationCursorQuery>;

export const NotificationParams = t.Object({ notificationId: Uuid });

export const ReadNotificationsBody = t.Object({
	through: t.Optional(t.String({ maxLength: 512 })),
});

const NotificationPreferenceKind = t.Union(NotificationKindValues.map((value) => t.Literal(value)));

export const ReplaceNotificationPreferencesBody = t.Object({
	items: t.Array(
		t.Object({
			kind: NotificationPreferenceKind,
			inApp: t.Boolean(),
			email: t.Boolean(),
		}),
		{ minItems: 1, maxItems: 6 },
	),
});

const NotificationItemResponse = t.Object({
	id: Uuid,
	kind: t.String(),
	title: t.String(),
	body: t.String(),
	actorProfileId: t.Nullable(Uuid),
	actorName: t.Nullable(t.String()),
	subjectUnitId: t.Nullable(Uuid),
	payload: t.Nullable(t.Unknown()),
	readAt: t.Nullable(DateTime),
	createdAt: DateTime,
});

export const NotificationListResponse = t.Object({
	items: t.Array(NotificationItemResponse),
	nextCursor: t.Nullable(t.String()),
	pollCursor: t.Nullable(t.String()),
	unreadCount: t.Integer(),
});

export const NotificationPreferencesResponse = t.Object({
	items: t.Array(t.Object({ kind: t.String(), inApp: t.Boolean(), email: t.Boolean() })),
});

export const UnreadCountResponse = t.Object({ count: t.Integer() });
