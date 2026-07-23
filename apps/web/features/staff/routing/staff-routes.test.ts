import { describe, expect, it } from "vitest";

import { parseStaffSection, staffSectionHref } from "./staff-routes";

describe("staff routes", () => {
	it("builds section routes", () => {
		expect(staffSectionHref("members")).toBe("/staff/members");
		expect(staffSectionHref("audit")).toBe("/staff/audit");
	});

	it.each([
		["/staff/members", "members"],
		["/staff/audit/", "audit"],
		["/staff", undefined],
		["/staff/members/nested", undefined],
		["/staff/unknown", undefined],
	] as const)("parses %s", (pathname, expected) => {
		expect(parseStaffSection(pathname)).toBe(expected);
	});
});
