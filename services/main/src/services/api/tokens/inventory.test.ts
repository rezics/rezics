import { describe, expect, it } from "vitest";

import { requiresActiveTokenReservation } from "./inventory";

const now = new Date("2026-07-31T12:00:00.000Z");

describe("API token active inventory", () => {
	it("reserves only when an update adds an active token to the account inventory", () => {
		expect(
			requiresActiveTokenReservation(
				{ enabled: false, expiresAt: new Date("2026-08-01T12:00:00.000Z") },
				{ enabled: true },
				now,
			),
		).toBe(true);
		expect(
			requiresActiveTokenReservation(
				{ enabled: true, expiresAt: new Date("2026-07-30T12:00:00.000Z") },
				{ expiresInDays: 30 },
				now,
			),
		).toBe(true);
	});

	it("does not reserve for an already-active token or an update that stays inactive", () => {
		expect(
			requiresActiveTokenReservation(
				{ enabled: true, expiresAt: null },
				{ expiresInDays: 30 },
				now,
			),
		).toBe(false);
		expect(
			requiresActiveTokenReservation(
				{ enabled: false, expiresAt: new Date("2026-07-30T12:00:00.000Z") },
				{ enabled: true },
				now,
			),
		).toBe(false);
	});
});
