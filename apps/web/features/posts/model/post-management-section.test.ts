import { describe, expect, it } from "vitest";

import {
	canOpenPostManagement,
	getPostManagementSectionIds,
	type PostManagementCapabilitySource,
} from "./post-management-section";

const ordinaryDenied = {
	postKind: "post",
	capabilities: {
		canEdit: false,
		canManageAttributions: false,
		canManageAccess: false,
	},
} as const satisfies PostManagementCapabilitySource;

const reviewDenied = {
	postKind: "review",
	capabilities: {
		canEdit: false,
		canManageAttributions: false,
		canManageAccess: false,
		canManageScores: false,
	},
} as const satisfies PostManagementCapabilitySource;

describe("post management section manifest", () => {
	it("opens an ordinary Post directly on its main editor", () => {
		expect(
			getPostManagementSectionIds({
				...ordinaryDenied,
				capabilities: { ...ordinaryDenied.capabilities, canEdit: true },
			}),
		).toEqual(["main", "history"]);
	});

	it("exposes attribution and access sections only with their exact capabilities", () => {
		expect(
			getPostManagementSectionIds({
				...ordinaryDenied,
				capabilities: {
					...ordinaryDenied.capabilities,
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
		expect(canOpenPostManagement(ordinaryDenied)).toBe(false);
		expect(canOpenPostManagement(reviewDenied)).toBe(false);
		expect(getPostManagementSectionIds(ordinaryDenied)).toEqual([]);
		expect(getPostManagementSectionIds(reviewDenied)).toEqual([]);
	});
});
