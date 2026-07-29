import { describe, expect, it } from "vitest";

import { deriveChapterReadingProgress, isAutomaticProgressCheckpointDue } from "./service";

describe("automatic chapter reading progress", () => {
	it("derives active and completed states without creating completion events", () => {
		expect(deriveChapterReadingProgress(2, 5)).toEqual({
			progress: 0.4,
			status: "active",
		});
		expect(deriveChapterReadingProgress(5, 5)).toEqual({
			progress: 1,
			status: "completed",
		});
	});

	it("rejects impossible chapter completion counts", () => {
		expect(() => deriveChapterReadingProgress(0, 0)).toThrow();
		expect(() => deriveChapterReadingProgress(4, 3)).toThrow();
		expect(() => deriveChapterReadingProgress(-1, 3)).toThrow();
	});

	it("uses a rolling 24-hour checkpoint interval", () => {
		const now = new Date("2026-07-29T12:00:00.000Z");
		expect(isAutomaticProgressCheckpointDue(undefined, now)).toBe(true);
		expect(isAutomaticProgressCheckpointDue(new Date("2026-07-28T12:00:00.001Z"), now)).toBe(
			false,
		);
		expect(isAutomaticProgressCheckpointDue(new Date("2026-07-28T12:00:00.000Z"), now)).toBe(
			true,
		);
	});
});
