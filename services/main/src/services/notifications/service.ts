import { and, eq } from "drizzle-orm";

import { notification, notificationPreference } from "../database/schema";
import type { ContentGovernanceActionKindValues, EnforcementKindValues } from "../database/schema";
import type { DatabaseTransaction } from "../database";
import { enqueueNotificationEmail } from "../email/outbox";
import { emailIntentDeliveryEnabled } from "../email/policy";

type ContentGovernanceActionKind = (typeof ContentGovernanceActionKindValues)[number];
type EnforcementKind = (typeof EnforcementKindValues)[number];

type NotificationBase = {
	recipientProfileId: string;
	dedupeKey?: string | null;
};

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
				subjectUnitId: string;
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
					  }
					| {
							type: "system_event";
							event: "unit_ownership_claim_resolution";
							references: {
								claimId: string;
								resolution: "approved" | "rejected" | "superseded";
							};
					  };
		  }
	);

export type NotificationTranslationKey =
	| NotificationInput["kind"]
	| "report_resolution"
	| "unit_access_invitation"
	| "unit_ownership_override"
	| "unit_ownership_claim_approved"
	| "unit_ownership_claim_rejected"
	| "unit_ownership_claim_superseded";

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
	if (
		kind === "system" &&
		typeof payload === "object" &&
		payload !== null &&
		"type" in payload &&
		payload.type === "system_event" &&
		"event" in payload &&
		payload.event === "unit_ownership_claim_resolution"
	) {
		const references =
			"references" in payload &&
			typeof payload.references === "object" &&
			payload.references !== null
				? payload.references
				: null;
		const resolution = references && "resolution" in references ? references.resolution : undefined;
		if (resolution === "approved") return "unit_ownership_claim_approved";
		if (resolution === "rejected") return "unit_ownership_claim_rejected";
		if (resolution === "superseded") return "unit_ownership_claim_superseded";
	}
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
