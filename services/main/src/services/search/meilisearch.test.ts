import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../config", () => ({
	env: {
		MEILISEARCH_URL: "http://meilisearch.test",
		MEILISEARCH_QUERY_KEY: "test-query-key-at-least-16-characters",
	},
}));

import { compileMeilisearchExpression, searchCandidates } from "./meilisearch";

afterEach(() => vi.unstubAllGlobals());

describe("Meilisearch expression compiler", () => {
	it("adds subtype applicability guards and converts dates to Unix seconds", () => {
		expect(
			compileMeilisearchExpression("units", {
				field: "book-page-count",
				operator: "exists",
				value: false,
			}),
		).toBe('(unitType IN ["book"] AND (book.pageCount NOT EXISTS))');
		expect(
			compileMeilisearchExpression("units", {
				field: "book-publication-date",
				operator: "range",
				lower: "2020-01-01T00:00:00.000Z",
			}),
		).toBe('(unitType IN ["book"] AND (book.publicationAt >= 1577836800))');
	});

	it("omits a whole Boolean tree when a residual-only leaf cannot be pushed safely", () => {
		expect(
			compileMeilisearchExpression("polls", {
				operator: "not",
				clause: { field: "closed", operator: "equals", value: true },
			}),
		).toBeUndefined();
	});

	it("coalesces concurrent categories into one multi-search request", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					results: [
						{ hits: [], estimatedTotalHits: 0, processingTimeMs: 1 },
						{ hits: [], estimatedTotalHits: 0, processingTimeMs: 1 },
					],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);
		vi.stubGlobal("fetch", fetchMock);
		const common = {
			indexUid: "rezics_units_v2_20260721",
			query: "book",
			offset: 0,
			limit: 20,
			sort: "relevance",
		} as const;
		await Promise.all([
			searchCandidates([{ ...common, category: "units" }]),
			searchCandidates([{ ...common, category: "users" }]),
		]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const request = fetchMock.mock.calls[0]?.[1];
		if (!request || typeof request.body !== "string")
			throw new TypeError("Expected a JSON multi-search request body");
		expect(JSON.parse(request.body).queries).toHaveLength(2);
	});
});
