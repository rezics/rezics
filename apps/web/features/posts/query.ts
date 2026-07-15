import {
	getApiFeedQueryKey,
	getApiPostsByPostIdQueryKey,
	getApiPostsByPostIdRepliesQueryKey,
	getApiPostsByPostIdRepliesThreadQueryKey,
	getApiPostsQueryKey,
} from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";

export async function invalidatePostQueries(
	queryClient: QueryClient,
	rootPostId?: string,
	affectedPostId?: string,
) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: getApiPostsQueryKey() }),
		queryClient.invalidateQueries({ queryKey: getApiFeedQueryKey() }),
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
					queryClient.invalidateQueries({
						queryKey: getApiPostsByPostIdRepliesThreadQueryKey({
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
