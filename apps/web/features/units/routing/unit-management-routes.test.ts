import { describe, expect, it } from "vitest";

import {
	chapterEditorHref,
	parseUnitManagementSection,
	unitManagementSectionHref,
} from "./unit-management-routes";

describe("unit management routes", () => {
	it("builds typed section routes", () => {
		expect(unitManagementSectionHref("series", "unit-1", "releases")).toBe(
			"/units/series/unit-1/edit/releases",
		);
	});

	it("keeps the focused chapter editor outside the management shell", () => {
		expect(chapterEditorHref("book-1", "chapter-1")).toBe(
			"/units/book/book-1/chapters/chapter-1/edit",
		);
	});

	it("maps comparison routes to history", () => {
		expect(
			parseUnitManagementSection("/units/book/unit-1/edit/history/compare", "book", "unit-1"),
		).toBe("history");
	});

	it("maps Dock management to the Dock section", () => {
		expect(
			parseUnitManagementSection("/units/media/unit-1/edit/docks", "media", "unit-1"),
		).toBe("docks");
	});

	it("keeps nested content-structure history in the content section", () => {
		expect(
			parseUnitManagementSection(
				"/units/book/unit-1/edit/content-structure/history",
				"book",
				"unit-1",
			),
		).toBe("content-structure");
	});
});
