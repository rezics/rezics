import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
	listCatalogEntityCandidates: vi.fn(),
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
		"tag-paths": "tag-paths",
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
	api.listCatalogEntityCandidates.mockReset();
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
						owner: "realm",
						shape: "realm",
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
				owner: "realm",
				shape: "realm",
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
						owner: "publishing",
						shape: "text_version",
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
				owner: "publishing",
				shape: "text_version",
				avatar: null,
			},
		]);
	});

	it("uses the permission-aware Entity endpoint for direct-credit searches", async () => {
		api.listCatalogEntityCandidates.mockResolvedValue({ data: { items: [] } });

		await searchEntities("entities", unitId, new AbortController().signal, {
			creditAttributionSearch: "direct",
		});

		expect(api.postApiUnitsPresentations).not.toHaveBeenCalled();
		expect(api.postApiSearchByIndex).not.toHaveBeenCalled();
		expect(api.listCatalogEntityCandidates).toHaveBeenCalledWith(
			expect.objectContaining({
				query: expect.objectContaining({
					mode: "direct",
					localizationLanguages: ["zh", "en"],
				}),
			}),
		);
	});

	it("omits the text query for an initial direct-credit list", async () => {
		api.listCatalogEntityCandidates.mockResolvedValue({ data: { items: [] } });

		await searchEntities("entities", "", new AbortController().signal, {
			creditAttributionSearch: "direct",
		});

		const request = api.listCatalogEntityCandidates.mock.calls[0]?.[0];
		expect(request?.query).toEqual({
			mode: "direct",
			limit: 10,
			localizationLanguages: ["zh", "en"],
		});
	});

	it("loads the selected Realm's available Tags without a text query", async () => {
		api.postApiSearchByIndex.mockResolvedValue({ data: { hits: [] } });
		const realmId = "019b0000-0000-7000-8000-000000000002";

		await searchEntities("tags", "", new AbortController().signal, {
			realmTagContextRealmId: realmId,
		});

		expect(api.postApiUnitsPresentations).not.toHaveBeenCalled();
		expect(api.postApiSearchByIndex).toHaveBeenCalledWith(
			expect.objectContaining({
				path: { index: "tags" },
				body: {
					query: "",
					owners: undefined,
					shapes: undefined,
					realmTagContextRealmId: realmId,
					limit: 10,
					localizationLanguages: ["zh", "en"],
				},
			}),
		);
	});
	it("sends owner and shape constraints before applying result limits", async () => {
		api.postApiSearchByIndex.mockResolvedValue({ data: { hits: [] } });
		await searchEntities("units", "text", new AbortController().signal, {
			owners: ["publishing"],
			shapes: ["text_version"],
		});
		expect(api.postApiSearchByIndex).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({ owners: ["publishing"], shapes: ["text_version"] }),
			}),
		);
	});
	it("rejects an exact resource with the wrong shape", async () => {
		api.postApiUnitsPresentations.mockResolvedValue({
			data: {
				items: [
					{ id: unitId, owner: "publishing", shape: "publication", title: "Edition", avatar: null },
				],
			},
		});
		api.postApiSearchByIndex.mockResolvedValue({ data: { hits: [] } });
		expect(
			await searchEntities("units", unitId, new AbortController().signal, {
				owners: ["publishing"],
				shapes: ["text_version"],
			}),
		).toEqual([]);
	});
	it("keeps only chapter shapes in a Post picker", async () => {
		api.postApiSearchByIndex.mockResolvedValue({
			data: {
				hits: [
					{ id: unitId, owner: "post", shape: "chapter", title: "Chapter", avatar: null },
					{ id: "other", owner: "post", shape: "review", title: "Review", avatar: null },
				],
			},
		});
		const result = await searchEntities("posts", "text", new AbortController().signal, {
			owners: ["post"],
			shapes: ["chapter"],
		});
		expect(result.map((item) => item.id)).toEqual([unitId]);
	});
});
