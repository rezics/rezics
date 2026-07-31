import { describe, expect, it } from "vitest";

import { parseRealmSettingsPath } from "./realm-settings-section";

const profileId = "019f995d-7595-7c99-9183-250790bbfe2f";

describe("Realm settings paths", () => {
	it.each([
		[undefined, { comparison: false }],
		[[], { comparison: false }],
		[["profile"], { section: "profile", comparison: false }],
		[["wiki"], { section: "wiki", comparison: false }],
		[["scoring"], { section: "scoring", comparison: false }],
		[["tag-voting"], { section: "tag-voting", comparison: false }],
		[["access"], { section: "access", comparison: false }],
		[["docks"], { section: "docks", comparison: false }],
		[["history", "compare"], { section: "history", comparison: true }],
	] as const)("parses %j", (segments, expected) => {
		expect(parseRealmSettingsPath(segments)).toEqual(expected);
	});

	it.each([
		["unknown"],
		["member-access"],
		["members", profileId],
		["members", profileId, "unknown"],
		["members", profileId, "permissions"],
		["profile", "nested"],
		["history", "unknown"],
	])("rejects %j", (...segments) => {
		expect(parseRealmSettingsPath(segments)).toBeUndefined();
	});
});
