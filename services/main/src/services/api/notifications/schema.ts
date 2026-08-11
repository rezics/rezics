import { type Static, t } from "elysia";

import {
	ContentGovernanceActionKindValues,
	EnforcementKindValues,
	NotificationKindValues,
} from "../../database/schema/contract-values";
import { CountResultSchema } from "../../counts/contract";
import { DateTime, UnitKind, Uuid } from "../schema";
import { NullablePublicSlugAddressResponse } from "../slug-addresses/schema";

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

const NotificationActorResponse = t.Object(
	{
		id: Uuid,
		name: t.Nullable(t.String()),
		slugAddress: NullablePublicSlugAddressResponse,
	},
	{ additionalProperties: false },
);

export const NotificationUnitResponse = t.Object(
	{
		id: Uuid,
		kind: UnitKind,
		slugAddress: NullablePublicSlugAddressResponse,
	},
	{ additionalProperties: false },
);

const NotificationItemBase = {
	id: Uuid,
	title: t.String(),
	body: t.String(),
	actor: t.Nullable(NotificationActorResponse),
	subject: t.Nullable(NotificationUnitResponse),
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
	{
		type: t.Literal("direct_message"),
		conversationId: Uuid,
		// Pre-1.4 notification rows did not identify the exact message. Their
		// conversation remains a safe semantic fallback during the cutover.
		messageId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);

export const RealmNotificationPayload = t.Object(
	{ type: t.Literal("realm_event"), event: t.Literal("membership_updated") },
	{ additionalProperties: false },
);

export const SystemNotificationPayload = t.Union([
	t.Object(
		{
			type: t.Literal("system_event"),
			event: t.Literal("unit_access_invitation"),
			references: t.Object({ invitationId: Uuid }, { additionalProperties: false }),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			type: t.Literal("system_event"),
			event: t.Literal("unit_ownership_override"),
			references: t.Object(
				{
					ownershipId: Uuid,
					role: t.Union([t.Literal("owner"), t.Literal("previous_owner")]),
				},
				{ additionalProperties: false },
			),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			type: t.Literal("system_event"),
			event: t.Literal("unit_ownership_claim_resolution"),
			references: t.Object(
				{
					claimId: Uuid,
					resolution: t.Union([
						t.Literal("approved"),
						t.Literal("rejected"),
						t.Literal("superseded"),
					]),
				},
				{ additionalProperties: false },
			),
		},
		{ additionalProperties: false },
	),
]);

const UnavailableNotificationContext = t.Object(
	{ type: t.Literal("unavailable") },
	{ additionalProperties: false },
);
const ReplyNotificationContext = t.Object(
	{ type: t.Literal("reply") },
	{ additionalProperties: false },
);
const NewFollowerNotificationContext = t.Object(
	{ type: t.Literal("new_follower") },
	{ additionalProperties: false },
);

const NotificationDetailsDestination = t.Object(
	{ kind: t.Literal("notification_details"), notificationId: Uuid },
	{ additionalProperties: false },
);
const PostDestination = t.Object(
	{ kind: t.Literal("post"), postId: Uuid },
	{ additionalProperties: false },
);
const ProfileDestination = t.Object(
	{
		kind: t.Literal("profile"),
		profile: t.Object(
			{ id: Uuid, slugAddress: NullablePublicSlugAddressResponse },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const ConversationDestination = t.Object(
	{
		kind: t.Literal("conversation"),
		conversationId: Uuid,
		messageId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);
const ReportDestination = t.Object(
	{ kind: t.Literal("report"), reportId: Uuid },
	{ additionalProperties: false },
);
const RealmDestination = t.Object(
	{
		kind: t.Literal("realm"),
		realm: t.Object(
			{ id: Uuid, slugAddress: NullablePublicSlugAddressResponse },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const AccessInvitationDestination = t.Object(
	{
		kind: t.Literal("access_invitation"),
		unitId: Uuid,
		invitationId: Uuid,
	},
	{ additionalProperties: false },
);
const UnitDestination = t.Object(
	{ kind: t.Literal("unit"), unit: NotificationUnitResponse },
	{ additionalProperties: false },
);

export const NotificationItemResponse = t.Union([
	t.Object({
		...NotificationItemBase,
		kind: t.Literal("reply"),
		context: t.Union([ReplyNotificationContext, UnavailableNotificationContext]),
		destination: t.Union([PostDestination, NotificationDetailsDestination]),
	}),
	t.Object({
		...NotificationItemBase,
		kind: t.Literal("new_follower"),
		context: t.Union([NewFollowerNotificationContext, UnavailableNotificationContext]),
		destination: t.Union([ProfileDestination, NotificationDetailsDestination]),
	}),
	t.Object({
		...NotificationItemBase,
		kind: t.Literal("direct_message"),
		context: t.Union([DirectMessageNotificationPayload, UnavailableNotificationContext]),
		destination: t.Union([ConversationDestination, NotificationDetailsDestination]),
	}),
	t.Object({
		...NotificationItemBase,
		kind: t.Literal("moderation"),
		context: t.Union([ModerationNotificationPayload, UnavailableNotificationContext]),
		destination: t.Union([ReportDestination, NotificationDetailsDestination]),
	}),
	t.Object({
		...NotificationItemBase,
		kind: t.Literal("realm"),
		context: t.Union([RealmNotificationPayload, UnavailableNotificationContext]),
		destination: t.Union([RealmDestination, NotificationDetailsDestination]),
	}),
	t.Object({
		...NotificationItemBase,
		kind: t.Literal("system"),
		context: t.Union([SystemNotificationPayload, UnavailableNotificationContext]),
		destination: t.Union([
			AccessInvitationDestination,
			UnitDestination,
			NotificationDetailsDestination,
		]),
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

export const ReadNotificationResponse = t.Object({
	updated: t.Boolean(),
	readAt: t.Nullable(DateTime),
});

export const UnreadCountResponse = t.Object({ count: CountResultSchema });
