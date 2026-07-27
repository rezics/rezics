import { describe, expect, it } from "vitest";

import { consoleSectionHref, parseConsoleSection } from "./console-routes";

describe("console routes", () => {
	it("builds section routes", () => {
		expect(consoleSectionHref("access")).toBe("/console/access");
		expect(consoleSectionHref("audit")).toBe("/console/audit");
	});

	it.each([
		["/console/access", "access"],
		["/console/audit/", "audit"],
		["/console", undefined],
		["/console/access/nested", undefined],
		["/console/unknown", undefined],
	] as const)("parses %s", (pathname, expected) => {
		expect(parseConsoleSection(pathname)).toBe(expected);
	});
});
