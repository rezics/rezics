import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { UnitFilter, UnitPredicate } from "@rezics/filter";

import {
	FeedContentKindValues,
	FeedRatedWorkUnitKindValues,
	FeedRequest,
	FeedUnitKindValues,
} from "./schema";

const RealmId = "00000000-0000-4000-8000-000000000001";
const checkFeedRequest = (value: unknown) => Check(FeedRequest, [UnitPredicate, UnitFilter], value);

describe("Feed API contract", () => {
	it("can hydrate every Unit category exposed by mixed Search", () => {
		expect(FeedUnitKindValues).toContain("structure");
		expect(FeedContentKindValues).toContain("unit:structure");
	});

	it("presents a Series through the rated-work feed contract", () => {
		expect(FeedRatedWorkUnitKindValues).toContain("series");
	});

	it("accepts the canonical domain Filter tree", () => {
		expect(
			checkFeedRequest({
				filter: {
					search: { query: "memory" },
					where: {
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
				},
				sort: "best",
				limit: 20,
			}),
		).toBe(true);
	});

	it("rejects malformed and duplicate Filter sets", () => {
		expect(checkFeedRequest({ filter: { where: { kind: { in: [] } } } })).toBe(false);
		expect(checkFeedRequest({ filter: { where: { kind: { in: ["book", "book"] } } } })).toBe(
			false,
		);
		expect(
			checkFeedRequest({
				filter: {
					where: { localizations: { some: { language: { in: ["zh-Hant"] } } } },
				},
			}),
		).toBe(false);
		expect(checkFeedRequest({ filter: { search: { query: "" } } })).toBe(false);
	});

	it("keeps search inside UnitFilter and relevance outside Feed", () => {
		expect(checkFeedRequest({ filter: { search: { query: "book" } } })).toBe(true);
		expect(Check(FeedRequest, { query: "book" })).toBe(false);
		expect(Check(FeedRequest, { personalized: false })).toBe(false);
		expect(Check(FeedRequest, { sort: "relevance" })).toBe(false);
	});
});
