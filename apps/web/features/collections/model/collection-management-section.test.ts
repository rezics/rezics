import { describe, expect, it } from "vitest";

import {
	canOpenCollectionManagement,
	getCollectionManagementSectionIds,
} from "./collection-management-section";

const denied = {
	canEditDetails: false,
	canManageItems: false,
	canManagePublishers: false,
	canManageLocalizations: false,
	canManageAccess: false,
	canViewHistory: false,
	canRestoreHistory: false,
	canManageRealmPublications: false,
};

describe("Collection management section manifest", () => {
	it("uses server capabilities as the only visibility source", () => {
		expect(canOpenCollectionManagement(denied)).toBe(false);
		expect(getCollectionManagementSectionIds(denied)).toEqual([]);
	});

	it("keeps item and publisher permissions separate", () => {
		expect(
			getCollectionManagementSectionIds({
				...denied,
				canManageItems: true,
				canManagePublishers: true,
			}),
		).toEqual(["items", "publishers"]);
	});

	it("exposes Realm publication independently", () => {
		expect(
			getCollectionManagementSectionIds({
				...denied,
				canManageRealmPublications: true,
			}),
		).toEqual(["realms"]);
	});
});
