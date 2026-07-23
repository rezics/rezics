import { describe, expect, it } from "vitest";

import { toFiniteApiNumber, toNonNegativeApiInteger } from "./api-number";

describe("API number normalization", () => {
	it.each([
		[8, 8],
		["12", 12],
		["1.5", 1.5],
	] as const)("accepts finite wire values", (value, expected) => {
		expect(toFiniteApiNumber(value)).toBe(expected);
	});

	it.each([undefined, null, "not-a-number", Number.POSITIVE_INFINITY])(
		"rejects non-finite wire values",
		(value) => {
			expect(toFiniteApiNumber(value)).toBeUndefined();
		},
	);

	it("uses zero for invalid, negative, fractional, and unsafe counts", () => {
		expect(toNonNegativeApiInteger("9")).toBe(9);
		expect(toNonNegativeApiInteger(-1)).toBe(0);
		expect(toNonNegativeApiInteger(1.5)).toBe(0);
		expect(toNonNegativeApiInteger(Number.MAX_SAFE_INTEGER + 1)).toBe(0);
	});
});
