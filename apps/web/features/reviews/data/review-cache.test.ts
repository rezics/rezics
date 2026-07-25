import {
	getApiReviewsByReviewIdQueryKey,
	getApiReviewsQueryKey,
	getApiScoresByTargetIdQueryKey,
} from "@rezics/openapi-tanstack-query";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { FeedQueryKey } from "@/features/content-feed/query";
import { invalidateReviews } from "./review-cache";

describe("invalidateReviews", () => {
	it("invalidates feed, review, and contextual score projections", async () => {
		const queryClient = new QueryClient();
		const invalidateQueries = vi
			.spyOn(queryClient, "invalidateQueries")
			.mockResolvedValue(undefined);
		const reviewId = "019f995d-8738-7fdf-b308-21b90be88539";
		const targetId = "019f995d-73ad-7692-88d4-39741cbe6c34";
		const scoreContextUnitId = "019f995d-75ab-7510-af4f-435b1a1b053c";

		await invalidateReviews(queryClient, reviewId, targetId, scoreContextUnitId);

		expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: FeedQueryKey });
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: getApiReviewsQueryKey(),
		});
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: getApiReviewsQueryKey({ query: { targetId } }),
		});
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: getApiReviewsByReviewIdQueryKey({ path: { reviewId } }),
		});
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: getApiScoresByTargetIdQueryKey({
				path: { targetId },
				query: { contextUnitId: scoreContextUnitId },
			}),
		});
	});
});
