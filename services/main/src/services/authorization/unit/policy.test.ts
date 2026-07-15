import { describe, expect, it } from "vitest";

import { isPubliclyReadableUnit } from "./policy";

describe("unit visibility", () => {
	it.each([
		["published", "public", true],
		["published", "unlisted", true],
		["published", "private", false],
		["draft", "public", false],
	] as const)("treats %s/%s as publicly readable: %s", (status, visibility, expected) => {
		expect(isPubliclyReadableUnit(status, visibility)).toBe(expected);
	});
});
