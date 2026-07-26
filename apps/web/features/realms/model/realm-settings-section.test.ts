import { describe, expect, it } from "vitest";

import { realmMemberPermissionsHref } from "../routing/realm-settings-routes";
import { parseRealmSettingsPath } from "./realm-settings-section";

const profileId = "019f995d-7595-7c99-9183-250790bbfe2f";

describe("Realm settings paths", () => {
	it("keeps a member permissions page nested under members", () => {
		expect(realmMemberPermissionsHref("/r/design/settings", profileId)).toBe(
			`/r/design/settings/members/${profileId}/permissions`,
		);
	});

	it.each([
		[undefined, { comparison: false }],
		[[], { comparison: false }],
		[["profile"], { section: "profile", comparison: false }],
		[
			["members", profileId, "permissions"],
			{ section: "members", comparison: false, memberProfileId: profileId },
		],
		[["access"], { section: "access", comparison: false }],
		[["history", "compare"], { section: "history", comparison: true }],
	] as const)("parses %j", (segments, expected) => {
		expect(parseRealmSettingsPath(segments)).toEqual(expected);
	});

	it.each([
		["unknown"],
		["member-access"],
		["members", profileId],
		["members", profileId, "unknown"],
		["profile", "nested"],
		["history", "unknown"],
	])("rejects %j", (...segments) => {
		expect(parseRealmSettingsPath(segments)).toBeUndefined();
	});
});
