import { describe, expect, it } from "vitest";

import {
	DatabasePoolWaitObservationWindowMilliseconds,
	DatabasePoolWaitTracker,
	MaximumDatabasePoolWaitSamples,
} from "./pool-wait";

describe("DatabasePoolWaitTracker", () => {
	it("reports the nearest-rank p95 for the live observation window", () => {
		const tracker = new DatabasePoolWaitTracker();
		for (let duration = 1; duration <= 100; duration += 1) tracker.record(duration, 10_000);
		expect(tracker.p95Milliseconds(10_000)).toBe(95);
		expect(
			tracker.p95Milliseconds(10_000 + DatabasePoolWaitObservationWindowMilliseconds + 1),
		).toBe(0);
	});

	it("retains only the newest bounded sample set", () => {
		const tracker = new DatabasePoolWaitTracker();
		for (let index = 0; index < MaximumDatabasePoolWaitSamples + 10; index += 1)
			tracker.record(index < 10 ? 10_000 : 1, 20_000);
		expect(tracker.p95Milliseconds(20_000)).toBe(1);
	});
});
