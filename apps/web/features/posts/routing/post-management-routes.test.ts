import { describe, expect, it } from "vitest";

import {
	parsePostManagementSection,
	postManagementHref,
	postManagementSectionHref,
} from "./post-management-routes";

describe("Post management routes", () => {
	it("uses the main editor as the management root", () => {
		expect(postManagementHref("post", "post-1")).toBe("/posts/post-1/edit");
		expect(parsePostManagementSection("/posts/post-1/edit", "post", "post-1")).toBe("main");
	});

	it("builds Review management routes with the same section contract", () => {
		expect(postManagementSectionHref("review", "review-1", "access")).toBe(
			"/reviews/review-1/edit/access",
		);
		expect(
			parsePostManagementSection(
				"/reviews/review-1/edit/history/compare",
				"review",
				"review-1",
			),
		).toBe("history");
	});

	it("does not treat another resource path as a management section", () => {
		expect(
			parsePostManagementSection("/reviews/post-1/edit/history", "post", "post-1"),
		).toBeUndefined();
	});
});
