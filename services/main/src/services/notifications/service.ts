import { and, eq } from "drizzle-orm";

import { notification, notificationPreference } from "../database/schema";
import type { GovernanceReasonCodeValues, ModerationActionKindValues } from "../database/schema";
import type { DatabaseTransaction } from "../database";
import { enqueueNotificationEmail } from "../email/outbox";
import { emailIntentDeliveryEnabled } from "../email/policy";

type GovernanceReasonCode = (typeof GovernanceReasonCodeValues)[number];
type ModerationActionKind = (typeof ModerationActionKindValues)[number];

type NotificationBase = {
	recipientProfileId: string;
	actorProfileId?: string | null;
	subjectUnitId?: string | null;
	dedupeKey?: string | null;
};

export type NotificationInput = NotificationBase &
	(
		| { kind: "reply"; payload?: never }
		| { kind: "new_follower"; payload?: never }
		| {
				kind: "direct_message";
				payload: { type: "direct_message"; conversationId: string };
		  }
		| {
				kind: "moderation";
				payload:
					| {
							type: "moderation_action";
							actionId: string;
							actionKind: ModerationActionKind;
							reasonCode: GovernanceReasonCode;
							publicNoticePostId?: string;
					  }
					| {
							type: "report_resolution";
							reportId: string;
							actionId: string;
							actionKind: ModerationActionKind;
							reasonCode: GovernanceReasonCode;
							publicNoticePostId?: string;
					  };
		  }
		| {
				kind: "realm";
				payload: { type: "realm_event"; event: "membership_updated" };
		  }
		| {
				kind: "system";
				payload: {
					type: "system_event";
					event: string;
					references?: Record<string, string>;
				};
		  }
	);

export type NotificationTranslationKey =
	NotificationInput["kind"] | "report_resolution" | "unit_access_invitation";

export function notificationTranslationKey(
	kind: NotificationInput["kind"],
	payload: unknown,
): NotificationTranslationKey {
	if (
		kind === "moderation" &&
		typeof payload === "object" &&
		payload !== null &&
		"type" in payload &&
		payload.type === "report_resolution"
	)
		return "report_resolution";
	if (
		kind === "system" &&
		typeof payload === "object" &&
		payload !== null &&
		"type" in payload &&
		payload.type === "system_event" &&
		"event" in payload &&
		payload.event === "unit_access_invitation"
	)
		return "unit_access_invitation";
	return kind;
}

export async function createNotification(tx: DatabaseTransaction, input: NotificationInput) {
	if (input.actorProfileId && input.actorProfileId === input.recipientProfileId) return;
	const [preferences] = await tx
		.select({
			inApp: notificationPreference.inApp,
			email: notificationPreference.email,
		})
		.from(notificationPreference)
		.where(
			and(
				eq(notificationPreference.profileId, input.recipientProfileId),
				eq(notificationPreference.kind, input.kind),
			),
		)
		.limit(1);
	const inAppVisible = preferences?.inApp ?? true;
	const emailEnabled = emailIntentDeliveryEnabled("notification") && (preferences?.email ?? true);
	if (!inAppVisible && !emailEnabled) return;
	const [created] = await tx
		.insert(notification)
		.values({
			recipientProfileId: input.recipientProfileId,
			actorProfileId: input.actorProfileId,
			kind: input.kind,
			subjectUnitId: input.subjectUnitId,
			payload: input.payload,
			dedupeKey: input.dedupeKey,
			inAppVisible,
			emailStatus: emailEnabled ? "pending" : "not_requested",
		})
		.onConflictDoNothing()
		.returning({ id: notification.id });
	if (created && emailEnabled) await enqueueNotificationEmail(tx, created.id);
}
