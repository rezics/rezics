import { describe, expect, it } from "vitest";

import {
	bookChapterDraftRetryDelayMilliseconds,
	BookChapterDraftPolicyV1,
	shouldDraftBookChapter,
} from "./book-chapter-draft-policy";

describe("Book Chapter draft policy", () => {
	it("keeps claims and lifecycle writes bounded", () => {
		expect(BookChapterDraftPolicyV1.claimBatchSize).toBe(2);
		expect(BookChapterDraftPolicyV1.chapterBatchSize).toBe(25);
		expect(BookChapterDraftPolicyV1.chapterBatchSize).toBeLessThanOrEqual(25);
	});

	it("caps retry backoff", () => {
		expect(bookChapterDraftRetryDelayMilliseconds(1)).toBe(2_000);
		expect(bookChapterDraftRetryDelayMilliseconds(20)).toBe(60_000);
	});

	it("only drafts authorized published Chapters", () => {
		expect(shouldDraftBookChapter("published", true)).toBe(true);
		expect(shouldDraftBookChapter("published", false)).toBe(false);
		expect(shouldDraftBookChapter("draft", true)).toBe(false);
		expect(shouldDraftBookChapter("archived", true)).toBe(false);
	});
});
