import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
	postApiSearch: vi.fn(),
	postApiSearchByIndex: vi.fn(),
	postApiUnitsPresentations: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	PostApiSearchByIndexIndex: {
		units: "units",
		users: "users",
		entity: "entity",
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

import { searchEntities } from "./search-entities";

const unitId = "019fa2b0-1000-7000-8000-000000000001";

beforeEach(() => {
	api.postApiSearch.mockReset();
	api.postApiSearchByIndex.mockReset();
	api.postApiUnitsPresentations.mockReset();
});

describe("searchEntities", () => {
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
			expect.objectContaining({ body: { ids: [unitId] } }),
		);
	});

	it("does not perform an exact lookup for ordinary text", async () => {
		api.postApiSearchByIndex.mockResolvedValue({ data: { hits: [] } });

		await searchEntities("units", "群體智慧", new AbortController().signal);

		expect(api.postApiUnitsPresentations).not.toHaveBeenCalled();
	});
});
