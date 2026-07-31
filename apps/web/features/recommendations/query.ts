import type { QueryClient } from "@tanstack/react-query";
import { FeedQueryKey } from "@/features/content-feed/query";

export async function invalidateRecommendationQueries(queryClient: QueryClient) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: FeedQueryKey }),
		queryClient.invalidateQueries({
			queryKey: [{ url: "/api/v1/recommendations/units" }],
		}),
		queryClient.invalidateQueries({
			queryKey: [{ url: "/api/v1/recommendations/posts/:postId" }],
		}),
	]);
}
