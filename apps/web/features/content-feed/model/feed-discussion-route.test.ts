import { describe, expect, it } from "vitest";

import { feedUnitDiscussionHref } from "./feed-discussion-route";

describe("feedUnitDiscussionHref", () => {
	it("routes Book discussion actions to the existing Book discussion tab", () => {
		expect(feedUnitDiscussionHref("book", "book-id")).toBe("/units/book/book-id/discussion");
	});

	it("routes Tag discussion actions to the Tag-owned second tab", () => {
		expect(feedUnitDiscussionHref("tag", "tag-id")).toBe("/tags/tag-id/discussion");
	});

	it("does not invent discussion routes for unsupported Unit kinds", () => {
		expect(feedUnitDiscussionHref("entity", "entity-id")).toBeUndefined();
	});
});
