import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { UnitPredicate } from "@rezics/filter";

import { FeedRequest } from "./schema";

const RealmId = "00000000-0000-4000-8000-000000000001";
const checkFeedRequest = (value: unknown) => Check(FeedRequest, [UnitPredicate], value);

describe("Feed API contract", () => {
	it("accepts the canonical domain Filter tree", () => {
		expect(
			checkFeedRequest({
				filter: {
					all: [
						{ localizations: { some: { language: { in: ["zh", "en"] } } } },
						{
							realms: {
								some: {
									realm: { id: { in: [RealmId] } },
									status: { in: ["visible"] },
								},
							},
						},
					],
				},
				sort: "best",
				limit: 20,
			}),
		).toBe(true);
	});

	it("rejects malformed and duplicate Filter sets", () => {
		expect(checkFeedRequest({ filter: { kind: { in: [] } } })).toBe(false);
		expect(checkFeedRequest({ filter: { kind: { in: ["book", "book"] } } })).toBe(false);
		expect(
			checkFeedRequest({
				filter: { localizations: { some: { language: { in: ["zh-Hant"] } } } },
			}),
		).toBe(false);
	});

	it("keeps full-text and relevance outside Feed", () => {
		expect(Check(FeedRequest, { query: "book" })).toBe(false);
		expect(Check(FeedRequest, { personalized: false })).toBe(false);
		expect(Check(FeedRequest, { sort: "relevance" })).toBe(false);
	});
});
