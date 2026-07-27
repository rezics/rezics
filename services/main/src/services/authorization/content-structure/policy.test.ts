import { describe, expect, it } from "vitest";

import { isContentStructureNodeReadable } from "./policy";

describe("Content Structure node visibility", () => {
	it.each([
		[false, "published", "public", true],
		[false, "published", "unlisted", true],
		[false, "draft", "public", false],
		[false, "published", "private", false],
		[true, "draft", "private", true],
	] as const)(
		"allows canEditBook=%s unit=%s/%s: %s",
		(canEditBook, unitStatus, unitVisibility, expected) => {
			expect(isContentStructureNodeReadable(canEditBook, unitStatus, unitVisibility)).toBe(
				expected,
			);
		},
	);
});
