import { describe, expect, it } from "vitest";

import { unitAccessInvitationState } from "./invitations";

describe("Unit access invitation lifecycle", () => {
	const now = new Date("2026-07-19T12:00:00.000Z");

	it("derives pending and expiry without turning an invitation into access", () => {
		expect(
			unitAccessInvitationState(
				{ resolution: null, expiresAt: new Date("2026-07-20T00:00:00.000Z") },
				now,
			),
		).toBe("pending");
		expect(
			unitAccessInvitationState(
				{ resolution: null, expiresAt: new Date("2026-07-19T00:00:00.000Z") },
				now,
			),
		).toBe("expired");
	});

	it("preserves an explicit terminal resolution", () => {
		expect(
			unitAccessInvitationState(
				{ resolution: "accepted", expiresAt: new Date("2026-07-19T00:00:00.000Z") },
				now,
			),
		).toBe("accepted");
	});
});
