import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";
import { FilterSchemaModels } from "@rezics/filter";

import {
	FeedContentKindValues,
	FeedRatedWorkUnitKindValues,
	FeedRequest,
	FeedUnitKindValues,
} from "./schema";

const RealmId = "00000000-0000-4000-8000-000000000001";
const checkFeedRequest = (value: unknown) => Check(FilterSchemaModels, FeedRequest, value);

describe("Feed API contract", () => {
	it("does not expose dedicated Tag Path Units through mixed Feed", () => {
		expect(FeedUnitKindValues).not.toContain("tag_path");
		expect(FeedContentKindValues).not.toContain("unit:tag_path");
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

	it("accepts empty localization hints for Unit-order fallback", () => {
		expect(checkFeedRequest({ localizationLanguages: [] })).toBe(true);
		expect(checkFeedRequest({ localizationLanguages: ["zh", "en"] })).toBe(true);
		expect(checkFeedRequest({ localizationLanguages: ["en", "en"] })).toBe(false);
	});

	it("rejects malformed and duplicate Filter sets", () => {
		expect(checkFeedRequest({ filter: { where: { kind: { in: [] } } } })).toBe(false);
		expect(checkFeedRequest({ filter: { where: { kind: { in: ["book", "book"] } } } })).toBe(false);
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
