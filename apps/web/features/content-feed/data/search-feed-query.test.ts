import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
	postApiSearchFeaturesByTemplateFeed: vi.fn(),
	postApiSearchZonesByZoneIdFeatureFeed: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", () => api);

import { fetchSearchFeedPage, type SearchFeedRequest } from "./search-feed-query";

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
		api.postApiSearchFeaturesByTemplateFeed.mockResolvedValue({
			data: { items: [], total: 0 },
		});
		const signal = new AbortController().signal;

		await fetchSearchFeedPage({
			cursor: "s2_cursor",
			request,
			signal,
			source: { kind: "template", template: "global" },
			surface: "search",
		});

		expect(api.postApiSearchFeaturesByTemplateFeed).toHaveBeenCalledWith({
			path: { template: "global" },
			body: {
				...request,
				state: { sort: "best", cursor: "s2_cursor" },
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
			request,
			signal,
			source: { kind: "zone", zoneId: "00000000-0000-7000-8000-000000000002" },
			surface: "feed",
		});

		expect(api.postApiSearchZonesByZoneIdFeatureFeed).toHaveBeenCalledWith({
			path: { zoneId: "00000000-0000-7000-8000-000000000002" },
			body: {
				injections: request.injections,
				state: request.state,
				surface: "feed",
			},
			signal,
		});
		expect(api.postApiSearchFeaturesByTemplateFeed).not.toHaveBeenCalled();
	});
});
