import { describe, expect, it } from "vitest";

import { starValueToUnitScore } from "./score-value";

describe("starValueToUnitScore", () => {
	it("maps five half-step stars onto the complete 1–10 score domain", () => {
		expect(starValueToUnitScore(0.5)).toBe(1);
		expect(starValueToUnitScore(3.5)).toBe(7);
		expect(starValueToUnitScore(5)).toBe(10);
	});

	it("rejects values that cannot be represented by the score domain", () => {
		expect(starValueToUnitScore(0)).toBeUndefined();
		expect(starValueToUnitScore(1.25)).toBeUndefined();
		expect(starValueToUnitScore(5.5)).toBeUndefined();
		expect(starValueToUnitScore(Number.NaN)).toBeUndefined();
	});
});
