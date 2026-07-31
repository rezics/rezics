import { describe, expect, it, vi } from "vitest";

import { resolveFeedContinuationState } from "./feed-continuation";

const fetchNextPage = vi.fn();

function resolve(overrides: Partial<Parameters<typeof resolveFeedContinuationState>[0]> = {}) {
	return resolveFeedContinuationState({
		fetchNextPage,
		hasNextPage: true,
		isFetchNextPageError: false,
		isFetching: false,
		isFetchingNextPage: false,
		...overrides,
	});
}

describe("Feed continuation state", () => {
	it("exposes the load operation only while the next page is ready", () => {
		expect(resolve()).toEqual({ status: "ready", loadNext: fetchNextPage });
		expect(resolve({ isFetching: true })).toEqual({ status: "refreshing" });
		expect(resolve({ isFetching: true, isFetchingNextPage: true })).toEqual({
			status: "loading",
		});
	});

	it("keeps next-page failure distinct from exhaustion", () => {
		expect(resolve({ isFetchNextPageError: true })).toEqual({
			status: "error",
			retry: fetchNextPage,
		});
		expect(resolve({ hasNextPage: false })).toEqual({ status: "exhausted" });
	});
});
