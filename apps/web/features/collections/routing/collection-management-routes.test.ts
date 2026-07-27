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

	it("treats the workspace root as the overview", () => {
		expect(
			parseCollectionManagementSection("/collections/collection-1/edit", "collection-1"),
		).toBeUndefined();
	});
});
