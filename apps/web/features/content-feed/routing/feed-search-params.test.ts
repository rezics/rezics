import { createSerializer } from "nuqs/server";
import { describe, expect, it } from "vitest";

import {
	feedContentParser,
	feedLanguagesParser,
	feedRealmIdsParser,
	feedSortParser,
	feedTagIdsParser,
} from "./feed-search-params";

describe("Feed URL state", () => {
	it("parses the typed Feed vocabulary and compact defaults", () => {
		expect(feedSortParser.parseServerSide(undefined)).toBe("best");
		expect(feedSortParser.parseServerSide("hot")).toBe("hot");
		expect(feedSortParser.parseServerSide("unknown")).toBe("best");
		expect(feedContentParser.parseServerSide(undefined)).toEqual([]);
		expect(feedContentParser.parseServerSide("unit:book,post:review")).toEqual([
			"unit:book",
			"post:review",
		]);
		expect(feedContentParser.parseServerSide("unit:book,unknown")).toEqual(["unit:book"]);
		expect(feedLanguagesParser.parseServerSide(undefined)).toEqual([]);
		expect(feedLanguagesParser.parseServerSide("zh,en")).toEqual(["zh", "en"]);
		expect(feedRealmIdsParser.parseServerSide("realm-a,realm-b")).toEqual([
			"realm-a",
			"realm-b",
		]);
		expect(feedTagIdsParser.parseServerSide("tag-a,tag-b")).toEqual(["tag-a", "tag-b"]);
	});

	it("omits cleared Feed filters when serializing the homepage URL", () => {
		const serialize = createSerializer({
			content: feedContentParser,
			languages: feedLanguagesParser,
			realms: feedRealmIdsParser,
			sort: feedSortParser,
			tags: feedTagIdsParser,
		});

		expect(serialize({ content: [], languages: [], realms: [], sort: "best", tags: [] })).toBe(
			"",
		);
		expect(serialize({ content: ["unit:book", "post:review"] })).toBe(
			"?content=unit:book,post:review",
		);
	});
});
