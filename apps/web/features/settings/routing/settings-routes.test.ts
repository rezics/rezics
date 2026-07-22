import { describe, expect, it } from "vitest";

import { parseSettingsSection, settingsSectionHref } from "./settings-routes";

describe("settings routes", () => {
	it("builds section routes", () => {
		expect(settingsSectionHref("security")).toBe("/settings/security");
	});

	it.each([
		["/settings/profile", "profile"],
		["/settings/preferences/", "preferences"],
		["/settings", undefined],
		["/settings/profile/nested", undefined],
		["/settings/unknown", undefined],
	] as const)("parses %s", (pathname, expected) => {
		expect(parseSettingsSection(pathname)).toBe(expected);
	});
});
