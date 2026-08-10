import type { QueryClient } from "@tanstack/react-query";

import { SearchFeedQueryKey } from "./search-feed-query-key";
import { FeedQueryKey } from "../query";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isRatingDependentGeneratedQuery(queryKey: readonly unknown[]): boolean {
	if (queryKey[0] === "collections" && queryKey[1] === "content") return true;
	return queryKey.some((part) => {
		if (!isRecord(part) || typeof part.url !== "string") return false;
		return (
			part.url.startsWith("/api/v1/units/") ||
			part.url.startsWith("/api/v1/search/") ||
			part.url.startsWith("/api/v1/collections") ||
			part.url.startsWith("/api/v1/realms") ||
			part.url.startsWith("/api/v1/recommendations/") ||
			part.url === "/api/v1/users/me/following"
		);
	});
}

/** Reset discovery projections after a viewer's content-rating allowlist changes. */
export async function resetContentRatingDependentQueries(queryClient: QueryClient): Promise<void> {
	await Promise.all([
		queryClient.resetQueries({ queryKey: FeedQueryKey }),
		queryClient.resetQueries({ queryKey: SearchFeedQueryKey }),
		queryClient.resetQueries({
			predicate: ({ queryKey }) => isRatingDependentGeneratedQuery(queryKey),
		}),
	]);
}
