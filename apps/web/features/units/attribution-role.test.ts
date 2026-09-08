import { describe, expect, it } from "vitest";

import { findPrimaryAuthor, groupByAssociationRole } from "./attribution-role";

describe("attribution role model", () => {
	it("groups by role without losing the API position order", () => {
		const grouped = groupByAssociationRole([
			{ id: "first-author", role: "author" as const },
			{ id: "translator", role: "translator" as const },
			{ id: "second-author", role: "author" as const },
		]);

		expect(grouped).toEqual([
			{
				role: "author",
				items: [
					{ id: "first-author", role: "author" },
					{ id: "second-author", role: "author" },
				],
			},
			{
				role: "translator",
				items: [{ id: "translator", role: "translator" }],
			},
		]);
	});

	it("selects the first author from the position-ordered API result", () => {
		expect(
			findPrimaryAuthor([
				{ id: "publisher-first", role: "publisher" },
				{ id: "author-first", role: "author" },
				{ id: "author-second", role: "author" },
			]),
		).toEqual({ id: "author-first", role: "author" });
	});
});
