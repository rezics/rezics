import {
	getApiPostsByPostIdQueryKey,
	getApiPostsByPostIdRepliesQueryKey,
	getApiPostsQueryKey,
} from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";
import { FeedQueryKey } from "@/features/content-feed/query";
import { SearchFeedQueryKey } from "@/features/content-feed/data/search-feed-query-key";

export async function invalidatePostQueries(
	queryClient: QueryClient,
	rootPostId?: string,
	affectedPostId?: string,
) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: getApiPostsQueryKey() }),
		queryClient.invalidateQueries({ queryKey: FeedQueryKey }),
		queryClient.invalidateQueries({ queryKey: SearchFeedQueryKey }),
		...(rootPostId
			? [
					queryClient.invalidateQueries({
						queryKey: getApiPostsByPostIdQueryKey({ path: { postId: rootPostId } }),
					}),
					queryClient.invalidateQueries({
						queryKey: getApiPostsByPostIdRepliesQueryKey({
							path: { postId: rootPostId },
						}),
					}),
				]
			: []),
		...(affectedPostId && affectedPostId !== rootPostId
			? [
					queryClient.invalidateQueries({
						queryKey: getApiPostsByPostIdQueryKey({
							path: { postId: affectedPostId },
						}),
					}),
				]
			: []),
	]);
}
