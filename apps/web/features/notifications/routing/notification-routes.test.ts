import { describe, expect, it } from "vitest";

import { notificationHref } from "./notification-routes";

describe("notification destinations", () => {
	it("links report resolutions to the matching report history item", () => {
		const reportId = "019b76da-a800-7300-8000-000000000001";
		expect(
			notificationHref({
				kind: "moderation",
				payload: { type: "report_resolution", reportId },
			}),
		).toBe(`/reports?reportId=${reportId}#report-${reportId}`);
	});

	it("does not invent a destination for an unknown notification payload", () => {
		expect(notificationHref({ kind: "moderation", payload: { type: "unknown" } })).toBe(
			undefined,
		);
	});
});
