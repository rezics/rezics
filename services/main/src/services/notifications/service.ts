import { and, eq, sql } from "drizzle-orm";

import { database } from "../database";
import {
	notification,
	profile,
	notificationPreference,
	profilePreference,
	users,
} from "../database/schema";
import { getTranslation } from "../i18n";
import { sendMail } from "../mailer";
import type { DatabaseTransaction } from "../database";

type NotificationKind = NonNullable<typeof notification.$inferInsert.kind>;

export async function createNotification(
	tx: DatabaseTransaction,
	input: {
		recipientProfileId: string;
		actorProfileId?: string | null;
		kind: NotificationKind;
		subjectUnitId?: string | null;
		payload?: Record<string, unknown> | null;
		dedupeKey?: string | null;
	},
) {
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
				email: users.email,
				preferredLanguages: profilePreference.preferredLanguages,
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
			const { data: translation } = await getTranslation(row.preferredLanguages ?? []);
			const copy = translation.notifications[row.kind];
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
			console.error("Notification email delivery failed", { notificationId, error: message });
		}
	});
}
