import { describe, expect, it } from "vitest";

import { isRealmJoinable, isRealmVisible } from "./policy";

describe("realm policy", () => {
	it.each([
		["published", "public", undefined, true],
		["draft", "public", undefined, false],
		["PUBLISHED", "private", "active", true],
		["published", "private", "pending", false],
		["published", "private", "banned", false],
	] as const)("shows %s/%s to %s: %s", (status, visibility, membership, expected) => {
		expect(isRealmVisible(status, visibility, membership)).toBe(expected);
	});

	it.each([
		["published", "public", undefined, true],
		["published", "private", undefined, false],
		["published", "private", "pending", true],
		["published", "private", "active", true],
		["published", "private", "banned", false],
		["published", "public", "removed", false],
		["draft", "public", "active", false],
	] as const)("allows joining %s/%s as %s: %s", (status, visibility, membership, expected) => {
		expect(isRealmJoinable(status, visibility, membership)).toBe(expected);
	});
});
