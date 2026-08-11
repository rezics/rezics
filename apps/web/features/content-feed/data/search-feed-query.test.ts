import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
	postApiSearchFilterFeed: vi.fn(),
	postApiSearchZonesByZoneIdFilterFeed: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", () => api);

import {
	fetchSearchFeedPage,
	type SearchFeedRequest,
	withoutSearchFeedCursor,
} from "./search-feed-query";

const request = {
	contexts: [{ kind: "realm", realmId: "00000000-0000-7000-8000-000000000001" }],
	injections: [],
	state: { sort: "best" },
} satisfies SearchFeedRequest;

beforeEach(() => {
	api.postApiSearchFilterFeed.mockReset();
	api.postApiSearchZonesByZoneIdFilterFeed.mockReset();
});

describe("Search Feed page requests", () => {
	it("retains contexts for a Filter Feed and adds the continuation cursor", async () => {
		api.postApiSearchFilterFeed
			.mockResolvedValueOnce({
				data: { items: [{ id: "visible" }], total: 1, nextCursor: "s2_server-issued" },
			})
			.mockResolvedValueOnce({ data: { items: [], total: 1 } });
		const signal = new AbortController().signal;

		const firstPage = await fetchSearchFeedPage({
			localizationLanguages: ["zh", "en"],
			request,
			signal,
			source: { kind: "filter", filterDocument: {} },
			surface: "search",
		});
		if (!firstPage.nextCursor) throw new Error("Expected a continuation token");
		await fetchSearchFeedPage({
			cursor: firstPage.nextCursor,
			localizationLanguages: ["zh", "en"],
			request,
			signal,
			source: { kind: "filter", filterDocument: {} },
			surface: "search",
		});

		expect(api.postApiSearchFilterFeed).toHaveBeenNthCalledWith(2, {
			body: {
				filterDocument: {},
				contexts: request.contexts,
				injections: request.injections,
				localizationLanguages: ["zh", "en"],
				state: { sort: "best", cursor: "s2_server-issued" },
				surface: "search",
			},
			signal,
		});
		expect(api.postApiSearchZonesByZoneIdFilterFeed).not.toHaveBeenCalled();
	});

	it("uses the server-established Zone scope instead of forwarding client contexts", async () => {
		api.postApiSearchZonesByZoneIdFilterFeed.mockResolvedValue({
			data: { items: [], total: 0 },
		});
		const signal = new AbortController().signal;

		await fetchSearchFeedPage({
			localizationLanguages: ["zh", "en"],
			request,
			signal,
			source: { kind: "zone", zoneId: "00000000-0000-7000-8000-000000000002" },
			surface: "feed",
		});

		expect(api.postApiSearchZonesByZoneIdFilterFeed).toHaveBeenCalledWith({
			path: { zoneId: "00000000-0000-7000-8000-000000000002" },
			body: {
				injections: request.injections,
				localizationLanguages: ["zh", "en"],
				state: request.state,
				surface: "feed",
			},
			signal,
		});
		expect(api.postApiSearchFilterFeed).not.toHaveBeenCalled();
	});

	it("normalizes an exhausted page to an explicit null cursor", async () => {
		api.postApiSearchFilterFeed.mockResolvedValue({
			data: { items: [], total: 0 },
		});

		await expect(
			fetchSearchFeedPage({
				localizationLanguages: ["en"],
				request,
				source: { kind: "filter", filterDocument: {} },
				surface: "search",
			}),
		).resolves.toMatchObject({ nextCursor: null });
	});

	it("treats an empty page as terminal when the server still sends a cursor", async () => {
		api.postApiSearchFilterFeed.mockResolvedValue({
			data: { items: [], total: 0, nextCursor: "s2_internal-search-position" },
		});

		await expect(
			fetchSearchFeedPage({
				localizationLanguages: ["en"],
				request,
				source: { kind: "filter", filterDocument: {} },
				surface: "search",
			}),
		).resolves.toMatchObject({ items: [], nextCursor: null });
	});

	it("removes transport cursors before a request becomes a stable Feed identity", () => {
		expect(withoutSearchFeedCursor({ cursor: "s1_cursor", sort: "best" })).toEqual({
			sort: "best",
		});
	});
});
