import { describe, expect, it } from "vitest";

import { canOpenUnitManagement, getUnitManagementSectionIds } from "./unit-management-section";

const denied = {
	canEdit: false,
	canManageAccess: false,
	canManageAssociations: false,
	canCurateTags: false,
	canCurateReferences: {
		aliases: false,
		externalLinks: false,
	},
	canManageRealmPublications: false,
	hasDevelopmentPreviewAccess: false,
};

describe("unit management section manifest", () => {
	it("keeps access and history separate for an access-only manager", () => {
		expect(getUnitManagementSectionIds("media", { ...denied, canManageAccess: true })).toEqual([
			"access",
			"history",
		]);
	});

	it("keeps Realm publication and history available to a publication-only manager", () => {
		expect(
			getUnitManagementSectionIds("book", {
				...denied,
				canManageRealmPublications: true,
			}),
		).toEqual(["realms", "history"]);
	});

	it("keeps Tag curation and history available to a Tag-only manager", () => {
		expect(getUnitManagementSectionIds("book", { ...denied, canCurateTags: true })).toEqual([
			"tags",
			"history",
		]);
	});

	it("adds type-owned editors only to their matching unit unit", () => {
		const editable = { ...denied, canEdit: true };
		expect(getUnitManagementSectionIds("book", editable)).toContain("tags");
		expect(getUnitManagementSectionIds("book", { ...editable, canCurateTags: true })).toContain(
			"tags",
		);
		expect(getUnitManagementSectionIds("book", editable)).toContain("content-structure");
		expect(getUnitManagementSectionIds("series", editable)).toContain("releases");
		expect(getUnitManagementSectionIds("software", editable)).not.toContain(
			"content-structure",
		);
		expect(getUnitManagementSectionIds("media", editable)).toContain("content-structure");
		const previewEditor = { ...editable, hasDevelopmentPreviewAccess: true };
		expect(getUnitManagementSectionIds("software", previewEditor)).toContain(
			"content-structure",
		);
		expect(getUnitManagementSectionIds("media", previewEditor)).toContain("content-structure");
	});

	it("keeps timed media Units on the standard content, metadata, access, and history template", () => {
		const capabilities = {
			...denied,
			canEdit: true,
			canManageAccess: true,
			canManageAssociations: true,
			canCurateTags: true,
		};
		expect(getUnitManagementSectionIds("video", capabilities)).toEqual([
			"content",
			"metadata",
			"access",
			"history",
		]);
		expect(getUnitManagementSectionIds("audio", capabilities)).toEqual([
			"content",
			"metadata",
			"access",
			"history",
		]);
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
