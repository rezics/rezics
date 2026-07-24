import { describe, expect, it } from "vitest";

import { apiValueToUnitScore, starValueToUnitScore } from "./score-value";

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

describe("apiValueToUnitScore", () => {
	it("accepts only the complete persisted Score domain", () => {
		expect(apiValueToUnitScore(1)).toBe(1);
		expect(apiValueToUnitScore("10")).toBe(10);
		expect(apiValueToUnitScore(0)).toBeUndefined();
		expect(apiValueToUnitScore("1.5")).toBeUndefined();
		expect(apiValueToUnitScore("invalid")).toBeUndefined();
	});
});
