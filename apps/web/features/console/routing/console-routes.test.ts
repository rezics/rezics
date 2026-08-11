import { describe, expect, it } from "vitest";

import { consoleSectionHref, parseConsoleSection } from "./console-routes";

describe("console routes", () => {
	it("builds section routes", () => {
		expect(consoleSectionHref("users")).toBe("/console/users");
		expect(consoleSectionHref("units")).toBe("/console/units");
		expect(consoleSectionHref("ownership-claims")).toBe("/console/ownership-claims");
		expect(consoleSectionHref("unit-merges")).toBe("/console/unit-merges");
		expect(consoleSectionHref("moderation")).toBe("/console/moderation");
		expect(consoleSectionHref("audit")).toBe("/console/audit");
		expect(consoleSectionHref("api-quotas")).toBe("/console/api-quotas");
	});

	it.each([
		["/console/users", "users"],
		["/console/users/user-id", "users"],
		["/console/units", "units"],
		["/console/ownership-claims", "ownership-claims"],
		["/console/unit-merges", "unit-merges"],
		["/console/moderation", "moderation"],
		["/console/audit/", "audit"],
		["/console/api-quotas", "api-quotas"],
		["/console", undefined],
		["/console/unknown", undefined],
	] as const)("parses %s", (pathname, expected) => {
		expect(parseConsoleSection(pathname)).toBe(expected);
	});
});
