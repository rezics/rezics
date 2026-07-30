import { describe, expect, it } from "vitest";

import { createReviewScorePredicate } from "./unit-review-feed-filter";

describe("Review Feed score filter", () => {
	it("omits the predicate until both a scoring Realm and scores exist", () => {
		expect(createReviewScorePredicate({ scores: [] })).toBeUndefined();
		expect(
			createReviewScorePredicate({
				realmId: "019f9000-0000-7000-8000-000000000001",
				scores: [],
			}),
		).toBeUndefined();
	});

	it("uses the shared displayed-Score UnitPredicate schema", () => {
		expect(
			createReviewScorePredicate({
				realmId: "019f9000-0000-7000-8000-000000000001",
				scores: [7, 9],
			}),
		).toEqual({
			post: {
				is: {
					scores: {
						displayed: {
							some: {
								realm: {
									id: {
										in: ["019f9000-0000-7000-8000-000000000001"],
									},
								},
								value: { in: [7, 9] },
							},
						},
					},
				},
			},
		});
	});
});
