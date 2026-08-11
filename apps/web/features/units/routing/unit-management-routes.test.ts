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

	it("maps Tag curation to its own management section", () => {
		expect(unitManagementSectionHref("book", "unit-1", "tags")).toBe(
			"/units/book/unit-1/edit/tags",
		);
		expect(parseUnitManagementSection("/units/book/unit-1/edit/tags", "book", "unit-1")).toBe(
			"tags",
		);
	});

	it("keeps the management root as the overview and gives content its own route", () => {
		expect(unitManagementSectionHref("book", "unit-1", "content")).toBe(
			"/units/book/unit-1/edit/content",
		);
		expect(unitManagementSectionHref("book", "unit-1", "metadata")).toBe(
			"/units/book/unit-1/edit/metadata",
		);
		expect(parseUnitManagementSection("/units/book/unit-1/edit", "book", "unit-1")).toBe(undefined);
		expect(parseUnitManagementSection("/units/book/unit-1/edit/content", "book", "unit-1")).toBe(
			"content",
		);
		expect(
			parseUnitManagementSection("/units/book/unit-1/edit/basic", "book", "unit-1"),
		).toBeUndefined();
		expect(
			parseUnitManagementSection("/units/book/unit-1/edit/localizations", "book", "unit-1"),
		).toBeUndefined();
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
		expect(parseUnitManagementSection("/units/media/unit-1/edit/docks", "media", "unit-1")).toBe(
			"docks",
		);
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
