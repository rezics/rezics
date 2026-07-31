import { describe, expect, it } from "vitest";

import {
	collectionManagementSectionHref,
	parseCollectionManagementSection,
} from "./collection-management-routes";

describe("Collection management routes", () => {
	it("builds a typed section route", () => {
		expect(collectionManagementSectionHref("collection-1", "publishers")).toBe(
			"/collections/collection-1/edit/publishers",
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

	it("treats the workspace root as the overview", () => {
		expect(
			parseCollectionManagementSection("/collections/collection-1/edit", "collection-1"),
		).toBeUndefined();
	});

	it("builds content and metadata routes", () => {
		expect(collectionManagementSectionHref("collection-1", "content")).toBe(
			"/collections/collection-1/edit/content",
		);
		expect(
			parseCollectionManagementSection(
				"/collections/collection-1/edit/content",
				"collection-1",
			),
		).toBe("content");
		expect(collectionManagementSectionHref("collection-1", "metadata")).toBe(
			"/collections/collection-1/edit/metadata",
		);
		expect(
			parseCollectionManagementSection(
				"/collections/collection-1/edit/metadata",
				"collection-1",
			),
		).toBe("metadata");
	});
});
