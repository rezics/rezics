import { describe, expect, it } from "vitest";

import { tagSearchHref } from "./tag-links";

describe("tagSearchHref", () => {
	it("serializes one Tag through the shared search URL contract", () => {
		expect(tagSearchHref("book", [{ tagId: "tag-a", label: "Fantasy" }])).toBe(
			"/search?template=book&tag=tag-a&tagLabel=Fantasy",
		);
	});

	it("keeps multiple Tag identities aligned and removes duplicates", () => {
		expect(
			tagSearchHref("media", [
				{ tagId: "tag-a", label: "Fantasy" },
				{ tagId: "tag-b", label: "Mystery" },
				{ tagId: "tag-a", label: "Fantasy duplicate" },
			]),
		).toBe("/search?template=media&tag=tag-a,tag-b&tagLabel=Fantasy+duplicate,Mystery");
	});
});
