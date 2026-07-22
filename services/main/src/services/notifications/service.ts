import { and, eq, sql } from "drizzle-orm";
import { getActiveObservability } from "@rezics/observability";

import { database } from "../database";
import {
	notification,
	profile,
	notificationPreference,
	profilePreference,
	users,
} from "../database/schema";
import type { GovernanceReasonCodeValues, ModerationActionKindValues } from "../database/schema";
import { DefaultStoredUiLocale } from "../database/schema/contract-values";
import { getTranslation } from "../i18n";
import { sendMail } from "../mailer";
import type { DatabaseTransaction } from "../database";
import { toUiLocale } from "@rezics/i18n";

const { logger } = getActiveObservability();

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
							type: "feedback_resolution";
							feedbackId: string;
							resolutionCode: GovernanceReasonCode;
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

export type NotificationTranslationKey = NotificationInput["kind"] | "unit_access_invitation";

export function notificationTranslationKey(
	kind: NotificationInput["kind"],
	payload: unknown,
): NotificationTranslationKey {
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
	if (input.actorProfileId && input.actorProfileId === input.recipientProfileId) return undefined;
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
	const emailEnabled = preferences?.email ?? true;
	if (!inAppVisible && !emailEnabled) return undefined;
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
	return created?.id;
}

/** Delivery is deliberately single-shot: failure is recorded and never retried. */
export async function deliverNotificationEmail(notificationId: string | undefined) {
	if (!notificationId) return;
	await database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`notification-email:${notificationId}`}::text, 0))`,
		);
		const [row] = await tx
			.select({
				kind: notification.kind,
				payload: notification.payload,
				email: users.email,
				interfaceLocale: profilePreference.interfaceLocale,
			})
			.from(notification)
			.innerJoin(profile, eq(profile.id, notification.recipientProfileId))
			.leftJoin(profilePreference, eq(profilePreference.profileId, profile.id))
			.innerJoin(users, eq(users.id, profile.authUserId))
			.where(
				and(eq(notification.id, notificationId), eq(notification.emailStatus, "pending")),
			)
			.limit(1);
		if (!row) return;
		try {
			const { t } = await getTranslation("notifications", [
				toUiLocale(row.interfaceLocale ?? DefaultStoredUiLocale),
			]);
			const copy = t[notificationTranslationKey(row.kind, row.payload)];
			await sendMail({ to: row.email, subject: copy.title, text: copy.body });
			await tx
				.update(notification)
				.set({ emailStatus: "sent", emailedAt: new Date(), emailError: null })
				.where(
					and(
						eq(notification.id, notificationId),
						eq(notification.emailStatus, "pending"),
					),
				);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await tx
				.update(notification)
				.set({ emailStatus: "failed", emailError: message.slice(0, 2_000) })
				.where(
					and(
						eq(notification.id, notificationId),
						eq(notification.emailStatus, "pending"),
					),
				);
			logger.error("Notification email delivery failed", {
				eventName: "notification.email.failed",
				errorCode: "NotificationEmailFailed",
				error,
			});
		}
	});
}
