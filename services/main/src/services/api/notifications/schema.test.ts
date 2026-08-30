import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";

import {
	DirectMessageNotificationPayload,
	ModerationNotificationPayload,
	SystemNotificationPayload,
} from "./schema";

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

	it("identifies the exact direct message while accepting the 1.4 cutover fallback", () => {
		expect(
			Check(DirectMessageNotificationPayload, {
				type: "direct_message",
				conversationId: actionId,
				messageId: actionId,
			}),
		).toBe(true);
		expect(
			Check(DirectMessageNotificationPayload, {
				type: "direct_message",
				conversationId: actionId,
			}),
		).toBe(true);
	});

	it("rejects open-ended system events and reference bags", () => {
		expect(
			Check(SystemNotificationPayload, {
				type: "system_event",
				event: "unit_access_invitation",
				references: { invitationId: actionId },
			}),
		).toBe(true);
		expect(
			Check(SystemNotificationPayload, {
				type: "system_event",
				event: "another_event",
				references: {},
			}),
		).toBe(false);
		expect(
			Check(SystemNotificationPayload, {
				type: "system_event",
				event: "unit_access_invitation",
				references: { invitationId: actionId, unrelated: actionId },
			}),
		).toBe(false);
	});
});
