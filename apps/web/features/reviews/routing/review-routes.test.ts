import { describe, expect, it } from "vitest";

import { reviewHref, targetedReviewCreateHref } from "./review-routes";

describe("review routes", () => {
	it("addresses a new review from its catalog Unit", () => {
		expect(targetedReviewCreateHref("book", "019f94bc-8657-78ba-9e0a-3862e12e29db")).toBe(
			"/units/book/019f94bc-8657-78ba-9e0a-3862e12e29db/reviews/new",
		);
	});

	it("preserves the optional Realm context on Review detail links", () => {
		expect(reviewHref("019f94bc-8657-78ba-9e0a-3862e12e29db")).toBe(
			"/reviews/019f94bc-8657-78ba-9e0a-3862e12e29db",
		);
		expect(
			reviewHref(
				"019f94bc-8657-78ba-9e0a-3862e12e29db",
				"019f94bc-8657-78ba-9e0a-3862e12e29dc",
			),
		).toBe(
			"/reviews/019f94bc-8657-78ba-9e0a-3862e12e29db?realmId=019f94bc-8657-78ba-9e0a-3862e12e29dc",
		);
	});
});
