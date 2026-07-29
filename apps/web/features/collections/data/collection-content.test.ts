import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
	getApiCollectionsByCollectionIdItems: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", () => api);

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["zh"],
}));

import { fetchCollectionContentPage } from "./collection-content";

beforeEach(() => {
	api.getApiCollectionsByCollectionIdItems.mockReset();
});

describe("Collection content page requests", () => {
	it("throws generated client errors instead of returning undefined query data", async () => {
		const response = { items: [], nextCursor: null };
		api.getApiCollectionsByCollectionIdItems.mockResolvedValue({ data: response });
		const signal = new AbortController().signal;

		await expect(
			fetchCollectionContentPage({
				collectionId: "00000000-0000-4000-8000-000000000001",
				cursor: "next-page",
				localizationLanguages: ["zh", "en"],
				signal,
			}),
		).resolves.toBe(response);
		expect(api.getApiCollectionsByCollectionIdItems).toHaveBeenCalledWith({
			path: { collectionId: "00000000-0000-4000-8000-000000000001" },
			query: {
				limit: 50,
				localizationLanguages: ["zh", "en"],
				cursor: "next-page",
			},
			signal,
			throwOnError: true,
		});
	});
});
