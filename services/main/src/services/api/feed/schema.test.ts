import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { FeedQuery } from "./schema";

const RealmId = "00000000-0000-4000-8000-000000000001";

describe("Feed API contract", () => {
	it("accepts only language and Realm arrays as public Feed filters", () => {
		expect(
			Check(FeedQuery, {
				languages: ["zh", "en"],
				realmIds: [RealmId],
				sort: "best",
				limit: 20,
			}),
		).toBe(true);
	});

	it("rejects empty, duplicate, and unsupported filter arrays", () => {
		expect(Check(FeedQuery, { languages: [] })).toBe(false);
		expect(Check(FeedQuery, { languages: ["zh", "zh"] })).toBe(false);
		expect(Check(FeedQuery, { languages: ["zh-Hant"] })).toBe(false);
		expect(Check(FeedQuery, { realmIds: [] })).toBe(false);
		expect(Check(FeedQuery, { realmIds: [RealmId, RealmId] })).toBe(false);
	});

	it("does not expose Search or product-specific selection as Feed filters", () => {
		expect(Check(FeedQuery, { content: ["post:post"] })).toBe(false);
		expect(Check(FeedQuery, { subjectId: RealmId })).toBe(false);
		expect(Check(FeedQuery, { personalized: false })).toBe(false);
		expect(Check(FeedQuery, { sort: "relevance" })).toBe(false);
	});
});
