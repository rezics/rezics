import { describe, expect, it } from "vitest";

import {
	AllProgressHistoryStatuses,
	progressEntryReviewHref,
	progressHistoryFilterParser,
	toProgressHistoryFilter,
	unitProgressHref,
} from "./progress-routes";

const UnitId = "019f0000-0000-7000-8000-000000000001";

describe("Progress routes", () => {
	it("keeps the Progress page outside the Unit tab route contract", () => {
		expect(unitProgressHref("book", UnitId)).toBe(`/units/book/${UnitId}/progress`);
	});

	it("carries only the selected Progress entry into Review creation", () => {
		expect(progressEntryReviewHref("book", UnitId, "entry")).toBe(
			`/units/book/${UnitId}/reviews/new?progressEntryId=entry`,
		);
	});

	it.each([
		[undefined, AllProgressHistoryStatuses],
		["active", "active"],
		["completed", "completed"],
		["paused", AllProgressHistoryStatuses],
	])("parses the history filter %s", (value, expected) => {
		expect(progressHistoryFilterParser.parseServerSide(value)).toBe(expected);
	});

	it("falls back to all for values outside the history filters", () => {
		expect(toProgressHistoryFilter("paused")).toBe(AllProgressHistoryStatuses);
	});
});
