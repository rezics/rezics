import { describe, expect, it } from "vitest";

import {
	canOpenRealmSettings,
	getRealmSettingsSectionIds,
	isRealmOwner,
} from "./realm-permissions";

type RealmCapabilities = Parameters<typeof canOpenRealmSettings>[0];

function capabilities(overrides: Partial<RealmCapabilities> = {}): RealmCapabilities {
	return {
		canCreateUnits: false,
		canCreateReplies: false,
		canUpdateSettings: false,
		canReadMembers: false,
		canManageMembers: false,
		canUpdateRules: false,
		canManagePins: false,
		canManageTags: false,
		canUpdateTagVoting: false,
		canManageTagContexts: false,
		canModerateUnits: false,
		canManageAccess: false,
		canRestoreHistory: false,
		...overrides,
	};
}

describe("realm membership permissions", () => {
	it("opens settings from server-authoritative capabilities", () => {
		const input = capabilities({ canManagePins: true });
		expect(canOpenRealmSettings(input)).toBe(true);
		expect(getRealmSettingsSectionIds(input)).toEqual(["pins", "history"]);
	});

	it("does not infer settings access from membership roles", () => {
		expect(canOpenRealmSettings(capabilities())).toBe(false);
	});

	it("opens only the Dock section for a Dock-scoped editor", () => {
		const input = capabilities();
		expect(canOpenRealmSettings(input, true)).toBe(true);
		expect(getRealmSettingsSectionIds(input, true)).toEqual(["docks"]);
	});

	it("keeps member capabilities inside the members section", () => {
		expect(
			getRealmSettingsSectionIds(capabilities({ canReadMembers: true, canManageMembers: true })),
		).toEqual(["members", "history"]);
	});

	it("exposes Realm taxonomy settings only to Tag managers", () => {
		expect(getRealmSettingsSectionIds(capabilities({ canManageTags: true }))).toEqual([
			"tags",
			"history",
		]);
	});

	it("keeps Tag voting and Tag Context relationships independent from taxonomy", () => {
		expect(
			getRealmSettingsSectionIds(
				capabilities({ canUpdateTagVoting: true, canManageTagContexts: true }),
			),
		).toEqual(["tag-voting", "history"]);
	});

	it("keeps Wiki navigation with Realm settings management", () => {
		expect(getRealmSettingsSectionIds(capabilities({ canUpdateSettings: true }))).toEqual([
			"profile",
			"pages",
			"wiki",
			"scoring",
			"history",
		]);
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
