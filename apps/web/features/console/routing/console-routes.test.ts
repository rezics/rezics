import { describe, expect, it } from "vitest";

import { consoleSectionHref, parseConsoleSection } from "./console-routes";

describe("console routes", () => {
	it("builds section routes", () => {
		expect(consoleSectionHref("users")).toBe("/console/users");
		expect(consoleSectionHref("moderation")).toBe("/console/moderation");
		expect(consoleSectionHref("audit")).toBe("/console/audit");
		expect(consoleSectionHref("token-policies")).toBe("/console/token-policies");
	});

	it.each([
		["/console/users", "users"],
		["/console/users/user-id", "users"],
		["/console/moderation", "moderation"],
		["/console/audit/", "audit"],
		["/console/token-policies", "token-policies"],
		["/console", undefined],
		["/console/unknown", undefined],
	] as const)("parses %s", (pathname, expected) => {
		expect(parseConsoleSection(pathname)).toBe(expected);
	});
});
