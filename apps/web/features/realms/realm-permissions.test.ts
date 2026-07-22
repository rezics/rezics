import { describe, expect, it } from "vitest";

import {
	canOpenRealmSettings,
	getRealmSettingsSectionIds,
	isRealmOwner,
} from "./realm-permissions";

describe("realm membership permissions", () => {
	it("opens settings from server-authoritative capabilities", () => {
		const capabilities = {
			canUpdateSettings: false,
			canReadMembers: false,
			canManageMembers: false,
			canPublishRules: false,
			canManagePins: true,
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
				canUpdateSettings: false,
				canReadMembers: false,
				canManageMembers: false,
				canPublishRules: false,
				canManagePins: false,
				canModerateUnits: false,
				canManageAccess: false,
				canRestoreHistory: false,
			}),
		).toBe(false);
	});

	it.each([
		[{ role: "owner", state: "active" }, true],
		[{ role: "owner", state: "banned" }, false],
		[{ role: "admin", state: "active" }, false],
		[undefined, false],
	] as const)("identifies ownership state from %o", (membership, expected) => {
		expect(isRealmOwner(membership)).toBe(expected);
	});
});
