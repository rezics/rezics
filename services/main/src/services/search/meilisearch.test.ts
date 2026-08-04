import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../config", () => ({
	env: {
		MEILISEARCH_URL: "http://meilisearch.test",
		MEILISEARCH_QUERY_KEY: "test-query-key-at-least-16-characters",
		SEARCH_CANDIDATE_TIME_BUDGET_MS: 1_500,
	},
}));

import {
	compileMeilisearchExpression,
	createCandidateSearchContext,
	searchCandidates,
} from "./meilisearch";

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

	it("pushes only exact Realm Tag voting context identity", () => {
		const filter = {
			field: "realm-tag-vote",
			operator: "matches",
			realmId: "019b0000-0000-7000-8000-000000000002",
			tagId: "019b0000-0000-7000-8000-000000000001",
		} as const;
		expect(compileMeilisearchExpression("units", filter)).toBe(
			'(filters.realmTagVoteKeys = "019b0000-0000-7000-8000-000000000002:019b0000-0000-7000-8000-000000000001")',
		);
		expect(
			compileMeilisearchExpression("units", {
				...filter,
				score: { lower: 1 },
			}),
		).toBeUndefined();
	});

	it("pushes the Realm Tag Context candidate set", () => {
		expect(
			compileMeilisearchExpression("tags", {
				field: "realm-tag-context",
				operator: "equals",
				value: "019b0000-0000-7000-8000-000000000002",
			}),
		).toBe('(filters.realmTagContextRealmIds = "019b0000-0000-7000-8000-000000000002")');
	});

	it("pushes Entity ownership through the indexed owner profile IDs", () => {
		expect(
			compileMeilisearchExpression("entities", {
				field: "owner",
				operator: "equals",
				value: "019b0000-0000-7000-8000-000000000004",
			}),
		).toBe('(filters.ownerProfileIds = "019b0000-0000-7000-8000-000000000004")');
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
			indexUid: "rezics_units_v1_20260804",
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

	it("orders matching Feed candidates by best instead of text relevance", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					results: [{ hits: [], estimatedTotalHits: 0, processingTimeMs: 1 }],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		await searchCandidates([
			{
				indexUid: "rezics_units_v1_20260804",
				category: "units",
				query: "book",
				offset: 0,
				limit: 20,
				sort: "best",
			},
		]);

		const request = fetchMock.mock.calls[0]?.[1];
		if (!request || typeof request.body !== "string")
			throw new TypeError("Expected a JSON multi-search request body");
		expect(JSON.parse(request.body)).toMatchObject({
			queries: [
				{
					q: "book",
					matchingStrategy: "last",
					sort: ["ranking.recommendationBest:desc", "ranking.updatedAt:desc", "id:asc"],
				},
			],
		});
	});

	it("queries one globally sorted stream across category-specific branches", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					results: [
						{
							hits: [
								{
									id: "019f7eed-5d42-7102-8387-cc1d13b176d2",
									revision: 1,
									category: "posts",
									unitType: "post",
								},
							],
							estimatedTotalHits: 1,
							processingTimeMs: 1,
						},
					],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);
		vi.stubGlobal("fetch", fetchMock);
		const context = await createCandidateSearchContext(
			{
				id: "019f7eed-5d42-7102-8387-cc1d13b176d1",
				indexUid: "rezics_units_v1_20260804",
			},
			undefined,
		);

		const [result] = await searchCandidates([
			{
				indexUid: context.indexUid,
				accessFilter: context.accessFilter,
				branches: [
					{
						category: "units",
						expression: {
							field: "language",
							operator: "equals",
							value: "zh-Hant",
						},
					},
					{ category: "posts" },
				],
				query: "",
				offset: 0,
				limit: 20,
				sort: "createdAt:desc",
			},
		]);

		expect(result?.hits.map(({ category }) => category)).toEqual(["posts"]);
		const request = fetchMock.mock.calls[0]?.[1];
		if (!request || typeof request.body !== "string")
			throw new TypeError("Expected a JSON multi-search request body");
		const body = JSON.parse(request.body);
		expect(body.queries).toHaveLength(1);
		expect(body.queries[0]).toMatchObject({
			filter: [
				'((category = "units" AND (languages = "zh-Hant")) OR (category = "posts"))',
				"access.publicDiscoverable = true",
			],
			sort: ["ranking.createdAt:desc", "id:asc"],
		});
	});

	it("keeps relevance free of business sorting and relaxes common terms first", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					results: [{ hits: [], estimatedTotalHits: 0, processingTimeMs: 1 }],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		await searchCandidates([
			{
				indexUid: "rezics_units_v1_20260804",
				category: "units",
				query: "the complete title",
				offset: 0,
				limit: 20,
				sort: "relevance",
			},
		]);

		const request = fetchMock.mock.calls[0]?.[1];
		if (!request || typeof request.body !== "string")
			throw new TypeError("Expected a JSON multi-search request body");
		expect(JSON.parse(request.body)).toMatchObject({
			queries: [
				{
					q: "the complete title",
					matchingStrategy: "frequency",
					sort: [],
				},
			],
		});
	});
});
