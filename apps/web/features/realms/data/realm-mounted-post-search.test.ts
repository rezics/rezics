import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
	postApiSearchByIndex: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", () => api);

import {
	RealmScoreContextPostKinds,
	RealmTagContextPostKinds,
	searchRealmMountedPosts,
} from "./realm-mounted-post-search";

beforeEach(() => {
	api.postApiSearchByIndex.mockReset();
});

describe("searchRealmMountedPosts", () => {
	it.each([
		["score context", RealmScoreContextPostKinds, ["post", "wiki"]],
		["Tag Context", RealmTagContextPostKinds, ["wiki"]],
	] as const)(
		"restricts %s candidates to the requested mounted Post kinds",
		async (_, kinds, expectedKinds) => {
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

			const result = await searchRealmMountedPosts({
				realmId: "realm-id",
				query: "準則",
				signal,
				localizationLanguages: ["zh", "en"],
				kinds,
			});

			expect(api.postApiSearchByIndex).toHaveBeenCalledWith({
				path: { index: "posts" },
				body: {
					query: "準則",
					realmId: "realm-id",
					kinds: expectedKinds,
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
		},
	);
});
