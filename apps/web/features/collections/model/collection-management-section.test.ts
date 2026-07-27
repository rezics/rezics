import { describe, expect, it } from "vitest";

import {
	canOpenCollectionManagement,
	getCollectionManagementSectionIds,
} from "./collection-management-section";

const denied = {
	canEditDetails: false,
	canManageItems: false,
	canEditPresentation: false,
	canManageLocalizations: false,
	canManageAccess: false,
	canViewHistory: false,
	canRestoreHistory: false,
	canDelete: false,
};

describe("Collection management section manifest", () => {
	it("uses server capabilities as the only visibility source", () => {
		expect(canOpenCollectionManagement(denied)).toBe(false);
		expect(getCollectionManagementSectionIds(denied)).toEqual([]);
	});

	it("keeps item and presentation permissions separate", () => {
		expect(
			getCollectionManagementSectionIds({
				...denied,
				canManageItems: true,
				canEditPresentation: true,
			}),
		).toEqual(["items", "presentation"]);
	});

	it("shows Basics when delete is the only allowed operation", () => {
		expect(getCollectionManagementSectionIds({ ...denied, canDelete: true })).toEqual([
			"basic",
		]);
	});
});
