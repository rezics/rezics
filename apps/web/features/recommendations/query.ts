import { getApiRecommendationsUnitsQueryKey } from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";
import { FeedQueryKey } from "@/features/content-feed/query";

export async function invalidateRecommendationQueries(queryClient: QueryClient) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: FeedQueryKey }),
		queryClient.invalidateQueries({ queryKey: getApiRecommendationsUnitsQueryKey() }),
		queryClient.invalidateQueries({
			queryKey: [{ url: "/api/recommendations/posts/:postId" }],
		}),
	]);
}
