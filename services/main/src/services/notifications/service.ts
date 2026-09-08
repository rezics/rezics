import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import type { ContentGovernanceActionKindValues, EnforcementKindValues } from "../database/schema";
import {
	authEntity,
	notification,
	notificationPreference,
	participationGrant,
	users,
} from "../database/schema";
import { enqueueNotificationEmail } from "../email/outbox";
import { emailIntentDeliveryEnabled } from "../email/policy";
import { MaximumEntitySecurityControllers } from "../participation/lifecycle";
import { resolveCanonicalUnitId } from "../units/merge/canonical";

type ContentGovernanceActionKind = (typeof ContentGovernanceActionKindValues)[number];
type EnforcementKind = (typeof EnforcementKindValues)[number];

type NotificationBase = (
	| { recipientEntityId: string; recipientAuthUserId?: never }
	| { recipientAuthUserId: string; recipientEntityId?: never }
) & { dedupeKey?: string | null };

export type NotificationInput = NotificationBase &
	(
		| {
				kind: "reply";
				actorProfileId: string;
				subjectUnitId: string;
				payload?: never;
		  }
		| {
				kind: "new_follower";
				actorProfileId: string;
				subjectUnitId?: never;
				payload?: never;
		  }
		| {
				kind: "direct_message";
				actorProfileId: string;
				subjectUnitId?: never;
				payload: {
					type: "direct_message";
					conversationId: string;
					messageId: string;
				};
		  }
		| {
				kind: "moderation";
				actorProfileId: string;
				subjectUnitId?: string;
				payload:
					| {
							type: "content_governance_action";
							actionId: string;
							actionKind: ContentGovernanceActionKind;
							publicNoticePostId?: string;
					  }
					| {
							type: "report_resolution";
							reportId: string;
							referralId: string;
							actionId?: string;
							actionKind?: ContentGovernanceActionKind;
							resolution?: "dismissed";
							publicNoticePostId?: string;
					  }
					| {
							type: "account_enforcement_action";
							actionId: string;
							actionKind: "issue" | "revoke";
							enforcementKind: EnforcementKind;
							publicNoticePostId?: string;
					  };
		  }
		| {
				kind: "realm";
				actorProfileId: string;
				subjectUnitId: string;
				payload: { type: "realm_event"; event: "membership_updated" };
		  }
		| {
				kind: "system";
				actorProfileId: string;
				subjectUnitId: string;
				payload:
					| {
							type: "system_event";
							event: "unit_access_invitation";
							references: { invitationId: string };
					  }
					| {
							type: "system_event";
							event: "unit_ownership_override";
							references: {
								ownershipId: string;
								role: "owner" | "previous_owner";
							};
					  };
		  }
	);

export type NotificationTranslationKey =
	| NotificationInput["kind"]
	| "report_resolution"
	| "unit_access_invitation"
	| "unit_ownership_override";

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
	if (
		kind === "system" &&
		typeof payload === "object" &&
		payload !== null &&
		"type" in payload &&
		payload.type === "system_event" &&
		"event" in payload &&
		payload.event === "unit_ownership_override"
	)
		return "unit_ownership_override";
	return kind;
}

export async function createNotification(tx: DatabaseTransaction, input: NotificationInput) {
	if (input.actorProfileId === input.recipientEntityId) return;
	const [self] = input.recipientEntityId
		? await tx
				.select({ authUserId: authEntity.authUserId })
				.from(authEntity)
				.where(
					and(eq(authEntity.entityId, input.recipientEntityId), eq(authEntity.state, "active")),
				)
				.limit(1)
		: [];
	const candidates = input.recipientAuthUserId
		? [{ authUserId: input.recipientAuthUserId }]
		: self
			? [self]
			: input.recipientEntityId
				? await tx
						.selectDistinct({ authUserId: participationGrant.authUserId })
						.from(participationGrant)
						.where(
							and(
								eq(participationGrant.actingEntityId, input.recipientEntityId),
								eq(participationGrant.entityId, input.recipientEntityId),
								eq(participationGrant.capability, "entity.security"),
								isNull(participationGrant.revokedAt),
								or(
									isNull(participationGrant.expiresAt),
									sql`${participationGrant.expiresAt} > now()`,
								),
							),
						)
						.limit(MaximumEntitySecurityControllers + 1)
				: [];
	if (candidates.length > MaximumEntitySecurityControllers)
		throw new Error("Entity security controller bound is violated");
	const candidateIds = candidates.flatMap((candidate) =>
		candidate.authUserId ? [candidate.authUserId] : [],
	);
	if (!candidateIds.length) return;
	const recipients = await tx
		.select({ id: users.id })
		.from(users)
		.where(and(inArray(users.id, candidateIds), isNull(users.erasedAt)))
		.orderBy(users.id)
		.for("share");
	if (!recipients.length) return;
	const preferences = await tx
		.select()
		.from(notificationPreference)
		.where(
			and(
				inArray(
					notificationPreference.authUserId,
					recipients.map((recipient) => recipient.id),
				),
				eq(notificationPreference.kind, input.kind),
			),
		);
	const preferenceByAccount = new Map(
		preferences.map((preference) => [preference.authUserId, preference]),
	);
	const subjectUnitId =
		"subjectUnitId" in input && input.subjectUnitId
			? await resolveCanonicalUnitId(tx, input.subjectUnitId)
			: undefined;
	for (const recipient of recipients) {
		const preference = preferenceByAccount.get(recipient.id);
		const inAppVisible = preference?.inApp ?? true;
		const emailEnabled = emailIntentDeliveryEnabled("notification") && (preference?.email ?? true);
		if (!inAppVisible && !emailEnabled) continue;
		const [created] = await tx
			.insert(notification)
			.values({
				recipientAuthUserId: recipient.id,
				actorProfileId: input.actorProfileId,
				kind: input.kind,
				subjectUnitId,
				payload: input.payload,
				dedupeKey: input.dedupeKey,
				inAppVisible,
				emailStatus: emailEnabled ? "pending" : "not_requested",
			})
			.onConflictDoNothing()
			.returning({ id: notification.id });
		if (created && emailEnabled) await enqueueNotificationEmail(tx, created.id);
	}
}
