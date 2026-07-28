import { describe, expect, it } from "vitest";
import { isAvailableProfileSlug, isProfileSlugReserved, ProfileReservedSlugs } from "@rezics/slug";

import { InvalidSlug } from "./errors";
import { parseSlugLabel, SlugAddressMaximumDepth } from "./slug";

describe("Unit slug labels", () => {
	it("limits the current backend address policy to three segments", () => {
		expect(SlugAddressMaximumDepth).toBe(3);
	});

	it("accepts the storage label contract", () => {
		for (const value of ["a", "users", "slug-a", "a--b", "a".repeat(63)])
			expect(parseSlugLabel(value)).toBe(value);
	});

	it("rejects labels that cannot be stored", () => {
		for (const value of ["", "Upper", "-start", "end-", "under_score", "a".repeat(64)])
			expect(() => parseSlugLabel(value)).toThrow(InvalidSlug);
	});

	it("holds reserved Profile labels back from self-service assignment", () => {
		for (const slug of ProfileReservedSlugs) {
			expect(isProfileSlugReserved(slug)).toBe(true);
			expect(isAvailableProfileSlug(slug)).toBe(false);
		}
		expect(isAvailableProfileSlug("alice-example")).toBe(true);
		expect(isAvailableProfileSlug("Alice")).toBe(false);
	});
});
