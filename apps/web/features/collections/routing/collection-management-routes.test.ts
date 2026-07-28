import { describe, expect, it } from "vitest";

import {
	collectionManagementSectionHref,
	parseCollectionManagementSection,
} from "./collection-management-routes";

describe("Collection management routes", () => {
	it("builds a typed section route", () => {
		expect(collectionManagementSectionHref("collection-1", "presentation")).toBe(
			"/collections/collection-1/edit/presentation",
		);
	});

	it("maps a nested comparison route to History", () => {
		expect(
			parseCollectionManagementSection(
				"/collections/collection-1/edit/history/compare",
				"collection-1",
			),
		).toBe("history");
	});

	it("treats the workspace root as content", () => {
		expect(
			parseCollectionManagementSection("/collections/collection-1/edit", "collection-1"),
		).toBe("content");
	});

	it("builds content and metadata routes without legacy paths", () => {
		expect(collectionManagementSectionHref("collection-1", "content")).toBe(
			"/collections/collection-1/edit",
		);
		expect(collectionManagementSectionHref("collection-1", "metadata")).toBe(
			"/collections/collection-1/edit/metadata",
		);
		expect(
			parseCollectionManagementSection(
				"/collections/collection-1/edit/basic",
				"collection-1",
			),
		).toBeUndefined();
		expect(
			parseCollectionManagementSection(
				"/collections/collection-1/edit/localizations",
				"collection-1",
			),
		).toBeUndefined();
	});
});
