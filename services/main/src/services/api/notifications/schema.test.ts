import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { ModerationNotificationPayload } from "./schema";

const actionId = "0195c49b-8f3b-7e18-8c45-c2f36ee8d337";

describe("notification payload contracts", () => {
	it("carries semantic references without copied display text", () => {
		expect(
			Check(ModerationNotificationPayload, {
				type: "content_governance_action",
				actionId,
				actionKind: "remove",
			}),
		).toBe(true);
		expect(
			Check(ModerationNotificationPayload, {
				type: "content_governance_action",
				actionId,
				actionKind: "remove",
				message: "copied display text",
			}),
		).toBe(false);
	});

	it("rejects uncontracted moderation reasons", () => {
		expect(
			Check(ModerationNotificationPayload, {
				type: "report_resolution",
				reportId: actionId,
				referralId: actionId,
				actionId,
				actionKind: "remove",
				reasonCode: "free-form",
			}),
		).toBe(false);
	});

	it("identifies the exact referral resolved by a review team", () => {
		expect(
			Check(ModerationNotificationPayload, {
				type: "report_resolution",
				reportId: actionId,
				referralId: actionId,
				resolution: "dismissed",
			}),
		).toBe(true);
		expect(
			Check(ModerationNotificationPayload, {
				type: "report_resolution",
				reportId: actionId,
				resolution: "dismissed",
			}),
		).toBe(false);
	});
});
