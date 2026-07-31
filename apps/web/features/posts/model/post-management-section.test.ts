import { describe, expect, it } from "vitest";

import {
	canOpenPostManagement,
	getPostManagementSectionIds,
	type PostManagementCapabilitySource,
} from "./post-management-section";

const contentDenied = {
	postKind: "post",
	capabilities: {
		canEdit: false,
		canManageAttributions: false,
		canManageAccess: false,
		canManageRealmPublications: false,
	},
} as const satisfies PostManagementCapabilitySource;

const reviewDenied = {
	postKind: "review",
	capabilities: {
		canEdit: false,
		canManageAttributions: false,
		canManageAccess: false,
		canManageRealmPublications: false,
		canManageScores: false,
	},
} as const satisfies PostManagementCapabilitySource;

describe("post management section manifest", () => {
	it("opens a content-editable Post directly on its main editor", () => {
		expect(
			getPostManagementSectionIds({
				...contentDenied,
				capabilities: { ...contentDenied.capabilities, canEdit: true },
			}),
		).toEqual(["main", "history"]);
	});

	it("exposes Realm publication only with its exact capability", () => {
		expect(
			getPostManagementSectionIds({
				...contentDenied,
				capabilities: {
					...contentDenied.capabilities,
					canManageRealmPublications: true,
				},
			}),
		).toEqual(["realms", "history"]);
	});

	it("keeps Excerpts in the shared Post content editing lifecycle", () => {
		expect(
			getPostManagementSectionIds({
				...contentDenied,
				postKind: "excerpt",
				capabilities: { ...contentDenied.capabilities, canEdit: true },
			}),
		).toEqual(["main", "history"]);
	});

	it("keeps Wikis in the shared Post content editing lifecycle", () => {
		expect(
			getPostManagementSectionIds({
				...contentDenied,
				postKind: "wiki",
				capabilities: { ...contentDenied.capabilities, canEdit: true },
			}),
		).toEqual(["main", "history"]);
	});

	it("exposes attribution and access sections only with their exact capabilities", () => {
		expect(
			getPostManagementSectionIds({
				...contentDenied,
				capabilities: {
					...contentDenied.capabilities,
					canManageAttributions: true,
					canManageAccess: true,
				},
			}),
		).toEqual(["attributions", "access", "history"]);
	});

	it("keeps Score association management on the Review main editor", () => {
		expect(
			getPostManagementSectionIds({
				...reviewDenied,
				capabilities: { ...reviewDenied.capabilities, canManageScores: true },
			}),
		).toEqual(["main", "history"]);
	});

	it("does not open the workspace without a management capability", () => {
		expect(canOpenPostManagement(contentDenied)).toBe(false);
		expect(canOpenPostManagement(reviewDenied)).toBe(false);
		expect(getPostManagementSectionIds(contentDenied)).toEqual([]);
		expect(getPostManagementSectionIds(reviewDenied)).toEqual([]);
	});
});
