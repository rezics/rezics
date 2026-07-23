import {
	getApiReviewsByReviewIdQueryKey,
	getApiReviewsQueryKey,
	getApiScoresByTargetIdQueryKey,
} from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";

export async function invalidateReviews(
	queryClient: QueryClient,
	reviewId?: string,
	targetId?: string,
	scoreRealmId?: string,
): Promise<void> {
	const invalidations: Promise<unknown>[] = [
		queryClient.invalidateQueries({ queryKey: getApiReviewsQueryKey() }),
	];
	if (targetId)
		invalidations.push(
			queryClient.invalidateQueries({
				queryKey: getApiReviewsQueryKey({ query: { targetId } }),
			}),
		);
	if (reviewId)
		invalidations.push(
			queryClient.invalidateQueries({
				queryKey: getApiReviewsByReviewIdQueryKey({ path: { reviewId } }),
			}),
		);
	if (targetId && scoreRealmId)
		invalidations.push(
			queryClient.invalidateQueries({
				queryKey: getApiScoresByTargetIdQueryKey({
					path: { targetId },
					query: { realmId: scoreRealmId },
				}),
			}),
		);
	await Promise.all(invalidations);
}
