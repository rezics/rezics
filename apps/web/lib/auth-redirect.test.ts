import { describe, expect, it } from "vitest";

import { getAuthPortalMode, getSafeAuthDestination } from "./auth-redirect";

describe("post-auth redirect destination", () => {
	it.each([
		["/units/book?id=1", "/units/book?id=1"],
		["/", "/"],
		["//evil.example", "/"],
		["/\\evil.example", "/"],
		["/\t/evil.example", "/"],
		["https://evil.example", "/"],
		[null, "/"],
	] as const)("maps %s to %s", (value, expected) => {
		expect(getSafeAuthDestination(value)).toBe(expected);
	});
});

describe("authentication portal mode", () => {
	it.each([
		["login", "login"],
		["register", "register"],
		["forgot-password", "forgot-password"],
		["reset-password", "reset-password"],
		["verify-email", "verify-email"],
		["unknown", null],
		[null, null],
	] as const)("maps %s to %s", (value, expected) => {
		expect(getAuthPortalMode(value)).toBe(expected);
	});
});
