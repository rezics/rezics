import { describe, expect, it } from "vitest";

import { canOpenUnitManagement, getUnitManagementSectionIds } from "./unit-management-section";

const denied = {
	canEdit: false,
	canManageAccess: false,
	canManageAssociations: false,
	hasDevelopmentPreviewAccess: false,
};

describe("unit management section manifest", () => {
	it("keeps access and history separate for an access-only manager", () => {
		expect(getUnitManagementSectionIds("media", { ...denied, canManageAccess: true })).toEqual([
			"access",
			"history",
		]);
	});

	it("adds type-owned editors only to their matching catalog unit", () => {
		const editable = { ...denied, canEdit: true };
		expect(getUnitManagementSectionIds("book", editable)).toContain("content-structure");
		expect(getUnitManagementSectionIds("series", editable)).toContain("releases");
		expect(getUnitManagementSectionIds("software", editable)).not.toContain(
			"content-structure",
		);
		expect(getUnitManagementSectionIds("media", editable)).not.toContain("content-structure");
		const previewEditor = { ...editable, hasDevelopmentPreviewAccess: true };
		expect(getUnitManagementSectionIds("software", previewEditor)).toContain(
			"content-structure",
		);
		expect(getUnitManagementSectionIds("media", previewEditor)).toContain("content-structure");
	});

	it("does not expose a management workspace without a server capability", () => {
		expect(canOpenUnitManagement(denied)).toBe(false);
		expect(getUnitManagementSectionIds("book", denied)).toEqual([]);
	});

	it("opens only Dock management for a Dock-scoped editor", () => {
		expect(canOpenUnitManagement(denied, true)).toBe(true);
		expect(getUnitManagementSectionIds("book", denied, true)).toEqual(["docks"]);
		expect(getUnitManagementSectionIds("series", denied, true)).toEqual([]);
	});
});
