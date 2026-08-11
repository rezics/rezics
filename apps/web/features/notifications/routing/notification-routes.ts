import type { GetApiNotificationsStatus200 } from "@rezics/openapi-tanstack-query";

import { conversationHref } from "@/features/messages/routing/message-routes";
import { postHref } from "@/features/posts/url";
import { profileHref } from "@/features/profiles/profile-route";
import { myReportHref } from "@/features/reports/routing/report-routes";
import { realmHref } from "@/features/slugs/unit-route";
import { publicUnitHref } from "@/features/units/routing/public-unit-route";
import { isUnitId } from "@/features/units/model/unit-id";

export const NotificationsHref = "/notifications";
export const AccessInvitationsHref = `${NotificationsHref}/invitations`;

type NotificationItem = GetApiNotificationsStatus200["items"][number];

export function notificationDetailsHref(notificationId: string): string {
	return `${NotificationsHref}/${encodeURIComponent(notificationId)}`;
}

export function accessInvitationAnchorId(invitationId: string): string {
	return `invitation-${invitationId}`;
}

export function accessInvitationHref(unitId: string, invitationId: string): string {
	const query = new URLSearchParams({ invitationId, unitId });
	return `${AccessInvitationsHref}?${query.toString()}#${encodeURIComponent(
		accessInvitationAnchorId(invitationId),
	)}`;
}

export function parseSelectedInvitationId(
	value: string | readonly string[] | undefined,
): string | undefined {
	return typeof value === "string" && isUnitId(value) ? value : undefined;
}

export function notificationHref(item: Pick<NotificationItem, "id" | "destination">): string {
	const { destination } = item;
	switch (destination.kind) {
		case "post":
			return postHref(destination.postId);
		case "profile":
			return profileHref(destination.profile);
		case "conversation":
			return conversationHref(destination.conversationId, destination.messageId);
		case "report":
			return myReportHref(destination.reportId);
		case "realm":
			return realmHref(destination.realm);
		case "access_invitation":
			return accessInvitationHref(destination.unitId, destination.invitationId);
		case "unit":
			return (
				publicUnitHref(destination.unit.kind, destination.unit) ??
				notificationDetailsHref(item.id)
			);
		case "notification_details":
			return notificationDetailsHref(destination.notificationId);
	}
}
