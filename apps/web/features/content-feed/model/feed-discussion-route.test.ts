import { describe, expect, it } from "vitest";

import { feedUnitDiscussionHref } from "./feed-discussion-route";

describe("feedUnitDiscussionHref", () => {
	it("routes publishing discussion actions to the native catalog discussion page", () => {
		expect(feedUnitDiscussionHref("publishing", "work-id")).toBe(
			"/catalog/publishing/work-id/discussion",
		);
	});

	it("routes Tag discussion actions to the Tag-owned second tab", () => {
		expect(feedUnitDiscussionHref("tag", "tag-id")).toBe("/tags/tag-id/discussion");
	});

	it("does not invent discussion routes for unsupported Unit kinds", () => {
		expect(feedUnitDiscussionHref("entity", "entity-id")).toBeUndefined();
	});
});
