import { describe, expect, it } from "vitest";

import type { GetApiNotificationsStatus200 } from "@rezics/openapi-tanstack-query";
import { notificationHref } from "./notification-routes";

type NotificationItem = GetApiNotificationsStatus200["items"][number];

function item(
	destination: NotificationItem["destination"],
): Pick<NotificationItem, "id" | "destination"> {
	return {
		id: "019b76da-a800-7300-8000-000000000001",
		destination,
	};
}

describe("notification destinations", () => {
	it("links every semantic destination to its owning frontend route", () => {
		const id = "019b76da-a800-7300-8000-000000000002";
		expect(notificationHref(item({ kind: "post", postId: id }))).toBe(`/posts/${id}`);
		expect(notificationHref(item({ kind: "profile", profile: { id, slugAddress: null } }))).toBe(
			`/user/${id}`,
		);
		expect(
			notificationHref(item({ kind: "conversation", conversationId: id, messageId: id })),
		).toBe(`/messages/${id}#message-${id}`);
		expect(notificationHref(item({ kind: "report", reportId: id }))).toBe(
			`/reports?reportId=${id}#report-${id}`,
		);
		expect(notificationHref(item({ kind: "realm", realm: { id, slugAddress: null } }))).toBe(
			`/realm/${id}`,
		);
		expect(
			notificationHref(item({ kind: "access_invitation", unitId: id, invitationId: id })),
		).toBe(`/notifications/invitations?invitationId=${id}&unitId=${id}#invitation-${id}`);
		expect(
			notificationHref(item({ kind: "unit", unit: { id, kind: "book", slugAddress: null } })),
		).toBe(`/units/book/${id}`);
		expect(notificationHref(item({ kind: "notification_details", notificationId: id }))).toBe(
			`/notifications/${id}`,
		);
	});

	it("falls back to recipient-scoped details for an unroutable Unit kind", () => {
		const notificationId = "019b76da-a800-7300-8000-000000000001";
		expect(
			notificationHref(
				item({
					kind: "unit",
					unit: {
						id: "019b76da-a800-7300-8000-000000000002",
						kind: "realm_rule",
						slugAddress: null,
					},
				}),
			),
		).toBe(`/notifications/${notificationId}`);
	});
});
