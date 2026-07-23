import { describe, expect, it } from "vitest";

import { parseRealmSettingsPath } from "./realm-settings-section";

describe("Realm settings paths", () => {
	it.each([
		[undefined, { comparison: false }],
		[[], { comparison: false }],
		[["profile"], { section: "profile", comparison: false }],
		[["member-access"], { section: "member-access", comparison: false }],
		[["access"], { section: "access", comparison: false }],
		[["history", "compare"], { section: "history", comparison: true }],
	] as const)("parses %j", (segments, expected) => {
		expect(parseRealmSettingsPath(segments)).toEqual(expected);
	});

	it.each([["unknown"], ["profile", "nested"], ["history", "unknown"]])(
		"rejects %j",
		(...segments) => {
			expect(parseRealmSettingsPath(segments)).toBeUndefined();
		},
	);
});
