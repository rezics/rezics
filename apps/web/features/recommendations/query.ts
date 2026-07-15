import {
	getApiFeedQueryKey,
	getApiRecommendationsUnitsQueryKey,
} from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";

export async function invalidateRecommendationQueries(queryClient: QueryClient) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: getApiFeedQueryKey() }),
		queryClient.invalidateQueries({ queryKey: getApiRecommendationsUnitsQueryKey() }),
		queryClient.invalidateQueries({
			queryKey: [{ url: "/api/recommendations/posts/:postId" }],
		}),
	]);
}
