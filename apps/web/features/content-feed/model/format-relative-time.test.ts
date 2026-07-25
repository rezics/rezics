import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./format-relative-time";

const ReferenceTime = "2026-07-21T14:00:00.000Z";

describe("formatRelativeTime", () => {
	it("formats deterministic past values in the requested UI locale", () => {
		expect(formatRelativeTime("2026-07-21T12:00:00.000Z", "en", ReferenceTime)).toBe("2h ago");
		expect(formatRelativeTime("2026-07-21T12:00:00.000Z", "zh-Hant", ReferenceTime)).toBe(
			"2 小時前",
		);
	});

	it("preserves the direction of future values", () => {
		expect(formatRelativeTime("2026-07-23T14:00:00.000Z", "en", ReferenceTime)).toBe("in 2d");
	});

	it("rejects invalid date inputs at the formatting boundary", () => {
		expect(() => formatRelativeTime("not-a-date", "en", ReferenceTime)).toThrow(RangeError);
		expect(() => formatRelativeTime(ReferenceTime, "en", Number.NaN)).toThrow(RangeError);
	});
});
