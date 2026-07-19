import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { ModerationNotificationPayload } from "./schema";

const actionId = "0195c49b-8f3b-7e18-8c45-c2f36ee8d337";

describe("notification payload contracts", () => {
	it("carries semantic references without copied display text", () => {
		expect(
			Check(ModerationNotificationPayload, {
				type: "moderation_action",
				actionId,
				actionKind: "remove",
				reasonCode: "content_policy",
			}),
		).toBe(true);
		expect(
			Check(ModerationNotificationPayload, {
				type: "moderation_action",
				actionId,
				actionKind: "remove",
				reasonCode: "content_policy",
				message: "copied display text",
			}),
		).toBe(false);
	});

	it("rejects uncontracted moderation reasons", () => {
		expect(
			Check(ModerationNotificationPayload, {
				type: "feedback_resolution",
				feedbackId: actionId,
				resolutionCode: "free-form",
			}),
		).toBe(false);
	});
});
