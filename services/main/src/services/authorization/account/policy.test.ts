import { describe, expect, it } from "vitest";

import { doesEnforcementBlockAction } from "./policy";

describe("account enforcement", () => {
	it.each([
		["warning", "write", false],
		["silence", "write", false],
		["SILENCE", "contribute", true],
		["suspension", "write", true],
		["ban", "contribute", true],
		["rate_limit", "contribute", false],
	] as const)("blocks %s for %s: %s", (kind, action, expected) => {
		expect(doesEnforcementBlockAction(kind, action)).toBe(expected);
	});
});
