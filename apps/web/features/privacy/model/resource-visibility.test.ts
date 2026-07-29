import { describe, expect, it } from "vitest";

import {
	isResourceVisibility,
	resolveEffectiveResourceVisibility,
	ResourceVisibilityValues,
} from "./resource-visibility";

describe("resource visibility", () => {
	it("keeps the frontend domain aligned with the API values", () => {
		expect(ResourceVisibilityValues).toEqual(["public", "unlisted", "private"]);
		expect(isResourceVisibility("public")).toBe(true);
		expect(isResourceVisibility("followers")).toBe(false);
	});

	it.each([
		["public", "public", "public"],
		["public", "unlisted", "unlisted"],
		["public", "private", "private"],
		["unlisted", "public", "unlisted"],
		["unlisted", "unlisted", "unlisted"],
		["unlisted", "private", "private"],
		["private", "public", "private"],
		["private", "unlisted", "private"],
		["private", "private", "private"],
	] as const)(
		"resolves category %s and item %s to effective %s",
		(categoryVisibility, itemVisibility, expected) => {
			expect(resolveEffectiveResourceVisibility(categoryVisibility, itemVisibility)).toBe(
				expected,
			);
		},
	);
});
