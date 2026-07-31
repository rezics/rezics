import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
	getApiEntities: vi.fn(),
	postApiSearch: vi.fn(),
	postApiSearchByIndex: vi.fn(),
	postApiUnitsPresentations: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	PostApiSearchByIndexIndex: {
		units: "units",
		users: "users",
		entities: "entities",
		tags: "tags",
		"tag-structures": "tag-structures",
		posts: "posts",
		realms: "realms",
		collections: "collections",
		reviews: "reviews",
		polls: "polls",
	},
	...api,
}));

import { createEntitySearch } from "./search-entities";

const unitId = "019fa2b0-1000-7000-8000-000000000001";

beforeEach(() => {
	api.postApiSearch.mockReset();
	api.postApiSearchByIndex.mockReset();
	api.postApiUnitsPresentations.mockReset();
	api.getApiEntities.mockReset();
});

describe("searchEntities", () => {
	const searchEntities = createEntitySearch(["zh", "en"]);

	it("resolves an exact UUID into a normal Unit presentation", async () => {
		api.postApiSearchByIndex.mockResolvedValue({ data: { hits: [] } });
		api.postApiUnitsPresentations.mockResolvedValue({
			data: {
				items: [
					{
						id: unitId,
						kind: "realm",
						title: "群體智慧",
						avatar: { type: "emoji", emoji: "🧠" },
					},
				],
			},
		});

		const result = await searchEntities("units", unitId, new AbortController().signal);

		expect(result).toEqual([
			{
				id: unitId,
				kind: "realm",
				label: "群體智慧",
				avatar: { type: "emoji", emoji: "🧠" },
			},
		]);
		expect(api.postApiUnitsPresentations).toHaveBeenCalledWith(
			expect.objectContaining({
				body: { ids: [unitId], localizationLanguages: ["zh", "en"] },
			}),
		);
	});

	it("does not perform an exact lookup for ordinary text", async () => {
		api.postApiSearchByIndex.mockResolvedValue({
			data: {
				hits: [
					{
						id: unitId,
						kind: "book",
						title: "中文書名",
						titles: ["한국어 제목", "中文書名"],
						name: null,
						avatar: null,
					},
				],
			},
		});

		const result = await searchEntities("units", "群體智慧", new AbortController().signal);

		expect(api.postApiUnitsPresentations).not.toHaveBeenCalled();
		expect(api.postApiSearchByIndex).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					localizationLanguages: ["zh", "en"],
				}),
			}),
		);
		expect(result).toEqual([
			{
				id: unitId,
				label: "中文書名",
				kind: "book",
				avatar: null,
			},
		]);
	});

	it("uses the permission-aware Entity endpoint for direct-credit searches", async () => {
		api.getApiEntities.mockResolvedValue({ data: { items: [] } });

		await searchEntities("entities", unitId, new AbortController().signal, {
			creditAttributionSearch: "direct",
		});

		expect(api.postApiUnitsPresentations).not.toHaveBeenCalled();
		expect(api.postApiSearchByIndex).not.toHaveBeenCalled();
		expect(api.getApiEntities).toHaveBeenCalledWith(
			expect.objectContaining({
				query: expect.objectContaining({
					creditAttributionSearch: "direct",
					localizationLanguages: ["zh", "en"],
				}),
			}),
		);
	});

	it("omits the text query for an initial direct-credit list", async () => {
		api.getApiEntities.mockResolvedValue({ data: { items: [] } });

		await searchEntities("entities", "", new AbortController().signal, {
			creditAttributionSearch: "direct",
		});

		const request = api.getApiEntities.mock.calls[0]?.[0];
		expect(request?.query).toEqual({
			creditAttributionSearch: "direct",
			limit: 10,
			localizationLanguages: ["zh", "en"],
		});
	});
});
