import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
	postApiSearchFeaturesByTemplateFeed: vi.fn(),
	postApiSearchZonesByZoneIdFeatureFeed: vi.fn(),
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
	api.postApiSearchFeaturesByTemplateFeed.mockReset();
	api.postApiSearchZonesByZoneIdFeatureFeed.mockReset();
});

describe("Search Feed page requests", () => {
	it("retains contexts for a template Feed and adds the continuation cursor", async () => {
		api.postApiSearchFeaturesByTemplateFeed
			.mockResolvedValueOnce({
				data: { items: [], total: 1, nextCursor: "s2_server-issued" },
			})
			.mockResolvedValueOnce({ data: { items: [], total: 1 } });
		const signal = new AbortController().signal;

		const firstPage = await fetchSearchFeedPage({
			localizationLanguages: ["zh", "en"],
			request,
			signal,
			source: { kind: "template", template: "global" },
			surface: "search",
		});
		if (!firstPage.nextCursor) throw new Error("Expected a continuation token");
		await fetchSearchFeedPage({
			cursor: firstPage.nextCursor,
			localizationLanguages: ["zh", "en"],
			request,
			signal,
			source: { kind: "template", template: "global" },
			surface: "search",
		});

		expect(api.postApiSearchFeaturesByTemplateFeed).toHaveBeenNthCalledWith(2, {
			path: { template: "global" },
			body: {
				...request,
				localizationLanguages: ["zh", "en"],
				state: { sort: "best", cursor: "s2_server-issued" },
				surface: "search",
			},
			signal,
		});
		expect(api.postApiSearchZonesByZoneIdFeatureFeed).not.toHaveBeenCalled();
	});

	it("uses the server-established Zone scope instead of forwarding template contexts", async () => {
		api.postApiSearchZonesByZoneIdFeatureFeed.mockResolvedValue({
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

		expect(api.postApiSearchZonesByZoneIdFeatureFeed).toHaveBeenCalledWith({
			path: { zoneId: "00000000-0000-7000-8000-000000000002" },
			body: {
				injections: request.injections,
				localizationLanguages: ["zh", "en"],
				state: request.state,
				surface: "feed",
			},
			signal,
		});
		expect(api.postApiSearchFeaturesByTemplateFeed).not.toHaveBeenCalled();
	});

	it("normalizes an exhausted page to an explicit null cursor", async () => {
		api.postApiSearchFeaturesByTemplateFeed.mockResolvedValue({
			data: { items: [], total: 0 },
		});

		await expect(
			fetchSearchFeedPage({
				localizationLanguages: ["en"],
				request,
				source: { kind: "template", template: "global" },
				surface: "search",
			}),
		).resolves.toMatchObject({ nextCursor: null });
	});

	it("removes transport cursors before a request becomes a stable Feed identity", () => {
		expect(withoutSearchFeedCursor({ cursor: "s1_cursor", sort: "best" })).toEqual({
			sort: "best",
		});
	});
});
