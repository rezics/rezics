import { describe, expect, it } from "vitest";

import { parseBoundedNumber, parseNonNegativeInteger, toProgressStatus } from "./progress-record";

describe("progress record input", () => {
	it("narrows server statuses to the supported transition set", () => {
		expect(toProgressStatus("completed")).toBe("completed");
		expect(toProgressStatus("future-status")).toBe("active");
	});

	it("checks percentage bounds", () => {
		expect(parseBoundedNumber("45.5", { minimum: 0, maximum: 100 })).toBe(45.5);
		expect(parseBoundedNumber("-1", { minimum: 0, maximum: 100 })).toBeUndefined();
		expect(parseBoundedNumber("101", { minimum: 0, maximum: 100 })).toBeUndefined();
		expect(parseBoundedNumber("", { minimum: 0, maximum: 100 })).toBeUndefined();
	});

	it("accepts only non-negative safe integer counts", () => {
		expect(parseNonNegativeInteger("3")).toBe(3);
		expect(parseNonNegativeInteger("3.5")).toBeUndefined();
		expect(parseNonNegativeInteger("-1")).toBeUndefined();
	});
});
