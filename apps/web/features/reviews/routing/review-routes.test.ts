import { describe, expect, it } from "vitest";

import { targetedReviewCreateHref } from "./review-routes";

describe("review routes", () => {
	it("addresses a new review from its catalog Unit", () => {
		expect(targetedReviewCreateHref("book", "019f94bc-8657-78ba-9e0a-3862e12e29db")).toBe(
			"/units/book/019f94bc-8657-78ba-9e0a-3862e12e29db/reviews/new",
		);
	});
});
