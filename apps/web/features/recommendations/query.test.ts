import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateRecommendationQueries } from "./query";

describe("recommendation cache invalidation", () => {
	it("invalidates every recommendation surface after a global exclusion", async () => {
		const queryClient = new QueryClient();
		const invalidateQueries = vi
			.spyOn(queryClient, "invalidateQueries")
			.mockResolvedValue(undefined);

		await invalidateRecommendationQueries(queryClient);

		expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
			queryKey: [{ url: "/api/feed" }],
		});
		expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
			queryKey: [{ url: "/api/recommendations/units" }],
		});
		expect(invalidateQueries).toHaveBeenNthCalledWith(3, {
			queryKey: [{ url: "/api/recommendations/posts/:postId" }],
		});
	});
});
