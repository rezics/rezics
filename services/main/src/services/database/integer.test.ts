import { describe, expect, it } from "vitest";

import { toSafeInteger } from "./integer";

describe("PostgreSQL integer boundary", () => {
	it("accepts lossless database integer representations", () => {
		expect(toSafeInteger(12n, "count")).toBe(12);
		expect(toSafeInteger("12", "count")).toBe(12);
		expect(toSafeInteger(12, "count")).toBe(12);
	});

	it("rejects values without a safe integer proof", () => {
		expect(() => toSafeInteger("1.5", "count")).toThrow(TypeError);
		expect(() => toSafeInteger(1.5, "count")).toThrow(TypeError);
		expect(() => toSafeInteger(9_007_199_254_740_992n, "count")).toThrow(RangeError);
	});
});
