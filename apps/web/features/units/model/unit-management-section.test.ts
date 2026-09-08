import { describe, expect, it } from "vitest";

import { canOpenUnitManagement, getUnitManagementSectionIds } from "./unit-management-section";

const denied = {
	canEdit: false,
	canUpdateMetadataOnly: false,
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

describe("timed-media management capabilities", () => {
	it("keeps access separate from editing", () => {
		expect(getUnitManagementSectionIds("audio", { ...denied, canManageAccess: true })).toEqual([
			"access",
			"history",
		]);
	});
	it("exposes bounded Tag curation to its explicit manager", () => {
		expect(getUnitManagementSectionIds("video", { ...denied, canCurateTags: true })).toEqual([
			"tags",
			"history",
		]);
	});
	it("exposes publication management independently", () => {
		expect(
			getUnitManagementSectionIds("audio", { ...denied, canManageRealmPublications: true }),
		).toEqual(["realms", "history"]);
	});
	it.each(["video", "audio"] as const)("keeps %s on its concrete editor paths", (type) => {
		expect(
			getUnitManagementSectionIds(type, {
				...denied,
				canEdit: true,
				canCurateTags: true,
				canManageAccess: true,
			}),
		).toEqual(["content", "metadata", "tags", "access", "history"]);
	});
	it("does not expose management without a capability", () => {
		expect(canOpenUnitManagement(denied)).toBe(false);
		expect(getUnitManagementSectionIds("audio", denied)).toEqual([]);
	});
});
