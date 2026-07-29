import { describe, expect, it } from "vitest";

import { selectFeedRating } from "./feed-rating";

const preferred = {
	realmId: "00000000-0000-4000-8000-000000000001",
	realmTitle: "Preferred",
	totalScore: 18,
	totalCount: 2,
} as const;
const global = {
	realmId: "00000000-0000-4000-8000-000000000002",
	realmTitle: "Global",
	totalScore: 80,
	totalCount: 10,
} as const;

describe("selectFeedRating", () => {
	it("uses the preferred aggregate when the work has ratings there", () => {
		expect(selectFeedRating({ preferred, global })).toBe(preferred);
	});

	it("falls back to the global aggregate for a work missing preferred ratings", () => {
		expect(selectFeedRating({ preferred: null, global })).toBe(global);
	});

	it("reports an unrated work when neither context has an aggregate", () => {
		expect(selectFeedRating({ preferred: null, global: null })).toBeNull();
	});
});
