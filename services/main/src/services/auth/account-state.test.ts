import { describe, expect, it } from "vitest";

import { effectiveAccountState } from "./account-state";

describe("effective account state", () => {
	it("treats an absent control row as active at revision zero", () => {
		expect(effectiveAccountState(undefined)).toEqual({
			state: "active",
			reason: null,
			note: null,
			expiresAt: null,
			revision: 0,
			updatedAt: null,
			updatedByProfileId: null,
		});
	});

	it("keeps a current suspension effective", () => {
		const expiresAt = new Date("2026-08-01T00:00:00.000Z");
		expect(
			effectiveAccountState(
				{
					state: "suspended",
					reason: "security",
					note: "review",
					expiresAt,
					revision: 2,
					updatedAt: new Date("2026-07-28T00:00:00.000Z"),
					updatedByProfileId: "01900000-0000-7000-8000-000000000001",
				},
				new Date("2026-07-29T00:00:00.000Z"),
			).state,
		).toBe("suspended");
	});

	it("projects an expired suspension as active without losing its revision", () => {
		const state = effectiveAccountState(
			{
				state: "suspended",
				reason: "security",
				note: "review",
				expiresAt: new Date("2026-07-28T00:00:00.000Z"),
				revision: 3,
				updatedAt: new Date("2026-07-27T00:00:00.000Z"),
				updatedByProfileId: "01900000-0000-7000-8000-000000000001",
			},
			new Date("2026-07-29T00:00:00.000Z"),
		);
		expect(state).toMatchObject({
			state: "active",
			reason: null,
			note: null,
			expiresAt: null,
			revision: 3,
		});
	});
});
