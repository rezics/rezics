import { createSerializer } from "nuqs/server";
import { describe, expect, it } from "vitest";

import {
	feedContentParser,
	feedLanguagesParser,
	feedQueryParser,
	feedRealmIdsParser,
	feedSortParser,
	feedTagIdsParser,
} from "./feed-search-params";

describe("Feed URL state", () => {
	it("parses the typed Feed vocabulary and compact defaults", () => {
		expect(feedSortParser.parseServerSide(undefined)).toBe("best");
		expect(feedQueryParser.parseServerSide(undefined)).toBe("");
		expect(feedQueryParser.parseServerSide("memory")).toBe("memory");
		expect(feedQueryParser.parseServerSide("x".repeat(501))).toBe("");
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
		expect(
			feedRealmIdsParser.parseServerSide(
				"019f9000-0000-7000-8000-000000000001,019f9000-0000-7000-8000-000000000002",
			),
		).toEqual(["019f9000-0000-7000-8000-000000000001", "019f9000-0000-7000-8000-000000000002"]);
		expect(feedTagIdsParser.parseServerSide("tag-a")).toEqual([]);
	});

	it("omits cleared Feed filters when serializing the homepage URL", () => {
		const serialize = createSerializer({
			content: feedContentParser,
			languages: feedLanguagesParser,
			q: feedQueryParser,
			realms: feedRealmIdsParser,
			sort: feedSortParser,
			tags: feedTagIdsParser,
		});

		expect(
			serialize({
				content: [],
				languages: [],
				q: "",
				realms: [],
				sort: "best",
				tags: [],
			}),
		).toBe("");
		expect(serialize({ content: ["unit:book", "post:review"] })).toBe(
			"?content=unit:book,post:review",
		);
	});
});
