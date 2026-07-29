import { describe, expect, it } from "vitest";

import {
	canOpenRealmSettings,
	getRealmSettingsSectionIds,
	isRealmOwner,
} from "./realm-permissions";

describe("realm membership permissions", () => {
	it("opens settings from server-authoritative capabilities", () => {
		const capabilities = {
			canCreateUnits: false,
			canCreateReplies: false,
			canUpdateSettings: false,
			canReadMembers: false,
			canManageMembers: false,
			canUpdateRules: false,
			canManagePins: true,
			canManageTags: false,
			canModerateUnits: false,
			canManageAccess: false,
			canRestoreHistory: false,
		};
		expect(canOpenRealmSettings(capabilities)).toBe(true);
		expect(getRealmSettingsSectionIds(capabilities)).toEqual(["pins", "history"]);
	});

	it("does not infer settings access from membership roles", () => {
		expect(
			canOpenRealmSettings({
				canCreateUnits: false,
				canCreateReplies: false,
				canUpdateSettings: false,
				canReadMembers: false,
				canManageMembers: false,
				canUpdateRules: false,
				canManagePins: false,
				canManageTags: false,
				canModerateUnits: false,
				canManageAccess: false,
				canRestoreHistory: false,
			}),
		).toBe(false);
	});

	it("opens only the Dock section for a Dock-scoped editor", () => {
		const capabilities = {
			canCreateUnits: false,
			canCreateReplies: false,
			canUpdateSettings: false,
			canReadMembers: false,
			canManageMembers: false,
			canUpdateRules: false,
			canManagePins: false,
			canManageTags: false,
			canModerateUnits: false,
			canManageAccess: false,
			canRestoreHistory: false,
		};
		expect(canOpenRealmSettings(capabilities, true)).toBe(true);
		expect(getRealmSettingsSectionIds(capabilities, true)).toEqual(["docks"]);
	});

	it("keeps member capabilities inside the members section", () => {
		expect(
			getRealmSettingsSectionIds({
				canCreateUnits: false,
				canCreateReplies: false,
				canUpdateSettings: false,
				canReadMembers: true,
				canManageMembers: true,
				canUpdateRules: false,
				canManagePins: false,
				canManageTags: false,
				canModerateUnits: false,
				canManageAccess: false,
				canRestoreHistory: false,
			}),
		).toEqual(["members", "history"]);
	});

	it("exposes Realm taxonomy settings only to Tag managers", () => {
		expect(
			getRealmSettingsSectionIds({
				canCreateUnits: false,
				canCreateReplies: false,
				canUpdateSettings: false,
				canReadMembers: false,
				canManageMembers: false,
				canUpdateRules: false,
				canManagePins: false,
				canManageTags: true,
				canModerateUnits: false,
				canManageAccess: false,
				canRestoreHistory: false,
			}),
		).toEqual(["tags", "history"]);
	});

	it("keeps Wiki navigation with Realm settings management", () => {
		expect(
			getRealmSettingsSectionIds({
				canCreateUnits: false,
				canCreateReplies: false,
				canUpdateSettings: true,
				canReadMembers: false,
				canManageMembers: false,
				canUpdateRules: false,
				canManagePins: false,
				canManageTags: false,
				canModerateUnits: false,
				canManageAccess: false,
				canRestoreHistory: false,
			}),
		).toEqual(["profile", "pages", "wiki", "scoring", "history"]);
	});

	it.each([
		[{ isOwner: true, state: "active" }, true],
		[{ isOwner: true, state: "banned" }, false],
		[{ isOwner: false, state: "active" }, false],
		[undefined, false],
	] as const)("identifies ownership state from %o", (membership, expected) => {
		expect(isRealmOwner(membership)).toBe(expected);
	});
});
