import { type Static, t } from "elysia";

import {
	ContentGovernanceActionKindValues,
	EnforcementKindValues,
	NotificationKindValues,
} from "../../database/schema/contract-values";
import { CountResultSchema } from "../../counts/contract";
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

const NotificationItemBase = {
	id: Uuid,
	title: t.String(),
	body: t.String(),
	actorProfileId: t.Nullable(Uuid),
	actorName: t.Nullable(t.String()),
	subjectUnitId: t.Nullable(Uuid),
	readAt: t.Nullable(DateTime),
	createdAt: DateTime,
};

export const ModerationNotificationPayload = t.Union([
	t.Object(
		{
			type: t.Literal("content_governance_action"),
			actionId: Uuid,
			actionKind: t.UnionEnum(ContentGovernanceActionKindValues, {
				default: undefined,
			}),
			publicNoticePostId: t.Optional(Uuid),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			type: t.Literal("report_resolution"),
			reportId: Uuid,
			referralId: Uuid,
			actionId: t.Optional(Uuid),
			actionKind: t.Optional(
				t.UnionEnum(ContentGovernanceActionKindValues, {
					default: undefined,
				}),
			),
			resolution: t.Optional(t.Literal("dismissed")),
			publicNoticePostId: t.Optional(Uuid),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			type: t.Literal("account_enforcement_action"),
			actionId: Uuid,
			actionKind: t.Union([t.Literal("issue"), t.Literal("revoke")]),
			enforcementKind: t.UnionEnum(EnforcementKindValues, { default: undefined }),
			publicNoticePostId: t.Optional(Uuid),
		},
		{ additionalProperties: false },
	),
]);

export const DirectMessageNotificationPayload = t.Object(
	{ type: t.Literal("direct_message"), conversationId: Uuid },
	{ additionalProperties: false },
);

export const RealmNotificationPayload = t.Object(
	{ type: t.Literal("realm_event"), event: t.Literal("membership_updated") },
	{ additionalProperties: false },
);

export const SystemNotificationPayload = t.Object(
	{
		type: t.Literal("system_event"),
		event: t.String({ minLength: 1 }),
		references: t.Optional(t.Record(t.String(), t.String())),
	},
	{ additionalProperties: false },
);

export const NotificationItemResponse = t.Union([
	t.Object({ ...NotificationItemBase, kind: t.Literal("reply"), payload: t.Null() }),
	t.Object({ ...NotificationItemBase, kind: t.Literal("new_follower"), payload: t.Null() }),
	t.Object({
		...NotificationItemBase,
		kind: t.Literal("direct_message"),
		payload: DirectMessageNotificationPayload,
	}),
	t.Object({
		...NotificationItemBase,
		kind: t.Literal("moderation"),
		payload: ModerationNotificationPayload,
	}),
	t.Object({
		...NotificationItemBase,
		kind: t.Literal("realm"),
		payload: RealmNotificationPayload,
	}),
	t.Object({
		...NotificationItemBase,
		kind: t.Literal("system"),
		payload: SystemNotificationPayload,
	}),
]);

export const NotificationListResponse = t.Object({
	items: t.Array(NotificationItemResponse),
	nextCursor: t.Nullable(t.String()),
	pollCursor: t.Nullable(t.String()),
	unreadCount: CountResultSchema,
});

export const NotificationPreferencesResponse = t.Object({
	items: t.Array(t.Object({ kind: t.String(), inApp: t.Boolean(), email: t.Boolean() })),
});

export const UnreadCountResponse = t.Object({ count: CountResultSchema });
