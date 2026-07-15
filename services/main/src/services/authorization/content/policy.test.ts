import { describe, expect, it } from "vitest";

import { isChapterContentReadable } from "./policy";

describe("chapter content visibility", () => {
	it.each([
		[false, "published", "public", "published", true],
		[false, "published", "unlisted", "published", true],
		[false, "draft", "public", "published", false],
		[false, "published", "private", "published", false],
		[false, "published", "public", "draft", false],
		[true, "draft", "private", "draft", true],
	] as const)(
		"allows canEditBook=%s unit=%s/%s content=%s: %s",
		(canEditBook, unitStatus, unitVisibility, contentStatus, expected) => {
			expect(
				isChapterContentReadable(canEditBook, unitStatus, unitVisibility, contentStatus),
			).toBe(expected);
		},
	);
});
