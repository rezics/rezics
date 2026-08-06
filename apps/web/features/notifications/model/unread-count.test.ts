import { describe, expect, it } from "vitest";

import { formatUnreadCount, isEstimatedUnreadCount, normalizeUnreadCount } from "./unread-count";

describe("notification unread count", () => {
	it.each([
		[6, 6],
		["12", 12],
		[0, 0],
		[-1, 0],
		["not-a-count", 0],
		[undefined, 0],
	] as const)("normalizes %s", (value, expected) => {
		expect(normalizeUnreadCount(value)).toBe(expected);
	});

	it("rejects fractional and unsafe integers", () => {
		expect(normalizeUnreadCount(1.5)).toBe(0);
		expect(normalizeUnreadCount(Number.MAX_SAFE_INTEGER + 1)).toBe(0);
	});

	it("reads estimate values and preserves their approximate meaning", () => {
		const estimate = {
			kind: "estimate" as const,
			value: 128,
			asOf: "2026-08-06T00:00:00.000Z",
		};

		expect(normalizeUnreadCount(estimate)).toBe(128);
		expect(isEstimatedUnreadCount(estimate)).toBe(true);
		expect(formatUnreadCount(estimate)).toBe("≈99+");
		expect(formatUnreadCount(6)).toBe("6");
	});
});
