import { myReportHref } from "@/features/reports/routing/report-routes";

export const NotificationsHref = "/notifications";
export const AccessInvitationsHref = `${NotificationsHref}/invitations`;

export function notificationHref(item: { kind: string; payload: unknown }): string | undefined {
	if (
		item.kind === "system" &&
		typeof item.payload === "object" &&
		item.payload !== null &&
		"type" in item.payload &&
		item.payload.type === "system_event" &&
		"event" in item.payload &&
		item.payload.event === "unit_access_invitation"
	)
		return AccessInvitationsHref;
	if (
		item.kind === "moderation" &&
		typeof item.payload === "object" &&
		item.payload !== null &&
		"type" in item.payload &&
		item.payload.type === "report_resolution" &&
		"reportId" in item.payload &&
		typeof item.payload.reportId === "string"
	)
		return myReportHref(item.payload.reportId);
	return undefined;
}
