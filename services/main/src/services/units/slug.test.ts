import { describe, expect, it } from "vitest";

import { InvalidSlug } from "./errors";
import { generateSlugLabel, parseSlugLabel, SlugLabelPattern } from "./slug";

describe("Unit slug labels", () => {
	it("accepts the storage label contract", () => {
		for (const value of ["a", "users", "slug-a", "a--b", "a".repeat(63)])
			expect(parseSlugLabel(value)).toBe(value);
	});

	it("rejects labels that cannot be stored", () => {
		for (const value of ["", "Upper", "-start", "end-", "under_score", "a".repeat(64)])
			expect(() => parseSlugLabel(value)).toThrow(InvalidSlug);
	});

	it("generates a bounded validated label", () => {
		const value = generateSlugLabel("這是一個 Very Long Unit Title ".repeat(10), "post");
		expect(value.length).toBeLessThanOrEqual(63);
		expect(SlugLabelPattern.test(value)).toBe(true);
	});
});
