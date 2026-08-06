import { describe, expect, it } from "vitest";

import { estimateCount, exactCount, lowerBoundCount, parseCountResult } from "./contract";

describe("count result contract", () => {
	it("distinguishes exact and lower-bound values", () => {
		expect(exactCount(3)).toEqual({ kind: "exact", value: 3 });
		expect(lowerBoundCount(4)).toEqual({ kind: "lower-bound", value: 4 });
	});

	it("constructs estimates from a valid aggregate timestamp", () => {
		expect(estimateCount(3, new Date("2026-08-06T00:00:00.000Z"))).toEqual({
			kind: "estimate",
			value: 3,
			asOf: "2026-08-06T00:00:00.000Z",
		});
		expect(() => estimateCount(3, new Date("invalid"))).toThrow(RangeError);
	});

	it("runtime-validates estimates crossing a boundary", () => {
		const estimate = {
			kind: "estimate",
			value: 1_000,
			asOf: "2026-08-05T00:00:00.000Z",
			modifiedSinceAnalyze: 12,
			relativeError: 0.05,
		};
		expect(parseCountResult(estimate)).toBe(estimate);
		expect(() => parseCountResult({ kind: "estimate", value: 1_000 })).toThrow();
	});

	it("rejects unsafe count values before construction", () => {
		expect(() => exactCount(-1)).toThrow(RangeError);
		expect(() => lowerBoundCount(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
	});
});
