import { describe, expect, it } from "vitest";

import {
	EmptyReviewFilters,
	hasReviewFilters,
	parseReviewScoreFilters,
	reviewFilterCount,
	toggleReviewScore,
	type ReviewFilterModel,
} from "./review-filter-model";

describe("review filter model", () => {
	it("toggles independent Scores while preserving canonical order", () => {
		const withEight = toggleReviewScore(EmptyReviewFilters, 8);
		const withThreeAndEight = toggleReviewScore(withEight, 3);

		expect(withThreeAndEight.scores).toEqual([3, 8]);
		expect(toggleReviewScore(withThreeAndEight, 8).scores).toEqual([3]);
	});

	it("accepts only supported Score filter values", () => {
		expect(parseReviewScoreFilters(["10", "invalid", "1", "10"])).toEqual([1, 10]);
	});

	it("counts every applied selection", () => {
		const filters: ReviewFilterModel = {
			languages: ["en"],
			realm: { id: "realm-id", label: "Realm" },
			scores: [7, 8],
		};

		expect(reviewFilterCount(filters)).toBe(4);
		expect(hasReviewFilters(filters)).toBe(true);
		expect(hasReviewFilters(EmptyReviewFilters)).toBe(false);
	});
});
