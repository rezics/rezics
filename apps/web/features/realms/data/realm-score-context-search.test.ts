import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
	postApiSearchByIndex: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", () => api);

import { searchRealmScoreContextPosts } from "./realm-score-context-search";

beforeEach(() => {
	api.postApiSearchByIndex.mockReset();
});

describe("searchRealmScoreContextPosts", () => {
	it("restricts candidates to visible Posts and Wiki articles mounted in the Realm", async () => {
		api.postApiSearchByIndex.mockResolvedValue({
			data: {
				hits: [
					{
						id: "post-id",
						kind: "wiki",
						title: "評分準則",
						name: null,
						avatar: null,
					},
				],
			},
		});
		const signal = new AbortController().signal;

		const result = await searchRealmScoreContextPosts("realm-id", "準則", signal, ["zh", "en"]);

		expect(api.postApiSearchByIndex).toHaveBeenCalledWith({
			path: { index: "posts" },
			body: {
				query: "準則",
				realmId: "realm-id",
				kinds: ["post", "wiki"],
				limit: 10,
				localizationLanguages: ["zh", "en"],
			},
			signal,
		});
		expect(result).toEqual([
			{
				id: "post-id",
				label: "評分準則",
				kind: "wiki",
				avatar: null,
			},
		]);
	});
});
