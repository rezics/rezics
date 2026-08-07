import { describe, expect, it } from "vitest";

import { passwordConfirmationMatches } from "./password-confirmation";

describe("password confirmation", () => {
	it("accepts an exact confirmation", () => {
		expect(
			passwordConfirmationMatches(
				"correct horse battery staple",
				"correct horse battery staple",
			),
		).toBe(true);
	});

	it("rejects a different confirmation", () => {
		expect(
			passwordConfirmationMatches(
				"correct horse battery staple",
				"correct horse battery stape",
			),
		).toBe(false);
	});
});
