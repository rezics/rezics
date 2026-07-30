import { describe, expect, it } from "vitest";

import { createSubjectFeedPredicate } from "./subject-feed-filter";

describe("subject Feed Filter", () => {
	it("uses the shared Post predicate schema", () => {
		expect(
			createSubjectFeedPredicate({
				kind: "review",
				subjectId: "019f9000-0000-7000-8000-000000000001",
			}),
		).toEqual({
			post: {
				is: {
					kind: { in: ["review"] },
					subject: {
						is: {
							id: { in: ["019f9000-0000-7000-8000-000000000001"] },
						},
					},
				},
			},
		});
	});
});
