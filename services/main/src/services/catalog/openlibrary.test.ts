import { describe, expect, it } from "vitest";
import {
	OpenLibraryEditionSchema,
	OpenLibraryWorkSchema,
	openLibraryDate,
	openLibrarySourceKey,
} from "./openlibrary";

describe("Open Library source contracts", () => {
	it("preserves multiple ISBNs, Works and extension fields without merging identities", () => {
		const edition = OpenLibraryEditionSchema.parse({
			key: "/books/OL1M",
			type: { key: "/type/edition" },
			title: "Fixture",
			works: [{ key: "/works/OL1W" }, { key: "/works/OL2W" }],
			isbn_13: ["9780306406157", "9781861972712"],
			identifiers: { custom: ["a", "b"] },
			extension: { ordered: [1, 2] },
		});
		expect(edition.works).toHaveLength(2);
		expect(edition.isbn_13).toHaveLength(2);
		expect(edition.extension).toEqual({ ordered: [1, 2] });
	});
	it("keeps Work and Edition keys distinct and retains text wrappers", () => {
		expect(openLibrarySourceKey("/works/OL1W").objectType).toBe("work");
		expect(openLibrarySourceKey("/books/OL1M").objectType).toBe("edition");
		expect(
			OpenLibraryWorkSchema.parse({
				key: "/works/OL1W",
				type: { key: "/type/work" },
				title: "Fixture",
				description: { type: "/type/text", value: "Original" },
			}).description,
		).toEqual({ type: "/type/text", value: "Original" });
	});
	it("does not invent a month or day for a year-only publication date", () => {
		expect(openLibraryDate("2010")).toEqual({ year: 2010, month: null, day: null });
		expect(openLibraryDate("Spring 2010")).toBeNull();
	});
});
