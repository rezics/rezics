import { describe, expect, it } from "vitest";

import { getSafeAuthDestination } from "./auth-redirect";

describe("post-auth redirect destination", () => {
	it.each([
		["/units/book?id=1", "/units/book?id=1"],
		["/", "/"],
		["//evil.example", "/"],
		["https://evil.example", "/"],
		[null, "/"],
	] as const)("maps %s to %s", (value, expected) => {
		expect(getSafeAuthDestination(value)).toBe(expected);
	});
});
