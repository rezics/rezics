import { describe, expect, it } from "vitest";

import { isWorkReleaseStatus, WorkReleaseStatusValues } from "./work-release-status";

describe("Work release status", () => {
	it("keeps the complete API status set in product order", () => {
		expect(WorkReleaseStatusValues).toEqual(["ongoing", "hiatus", "completed", "cancelled"]);
	});

	it("proves form values at runtime", () => {
		for (const status of WorkReleaseStatusValues)
			expect(isWorkReleaseStatus(status)).toBe(true);
		expect(isWorkReleaseStatus("releasing")).toBe(false);
		expect(isWorkReleaseStatus(null)).toBe(false);
	});
});
