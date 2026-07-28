import { describe, expect, it } from "vitest";

import {
	parsePostManagementSection,
	postManagementHref,
	postManagementSectionHref,
} from "./post-management-routes";

describe("Post management routes", () => {
	it("uses the main editor as the management root", () => {
		expect(postManagementHref("post-1")).toBe("/posts/post-1/edit");
		expect(parsePostManagementSection("/posts/post-1/edit", "post-1")).toBe("main");
	});

	it("builds every Post kind under the same management route family", () => {
		expect(postManagementSectionHref("review-1", "access")).toBe("/posts/review-1/edit/access");
		expect(parsePostManagementSection("/posts/review-1/edit/history/compare", "review-1")).toBe(
			"history",
		);
	});

	it("does not treat another resource path as a management section", () => {
		expect(
			parsePostManagementSection("/reviews/post-1/edit/history", "post-1"),
		).toBeUndefined();
	});
});
