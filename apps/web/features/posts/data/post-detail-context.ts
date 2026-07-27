"use client";

import { postApiFeedQuery, type PostApiFeedQueryStatus200 } from "@rezics/openapi-tanstack-query";
import { useQuery } from "@tanstack/react-query";

import { FeedQueryKey } from "@/features/content-feed/query";

type FeedPost = Extract<PostApiFeedQueryStatus200["items"][number], { readonly itemType: "post" }>;

export function usePostDetailContext(postId: string) {
	return useQuery({
		queryKey: [...FeedQueryKey, "post-detail-context", postId],
		queryFn: async ({ signal }): Promise<FeedPost | null> => {
			const { data } = await postApiFeedQuery({
				body: {
					filter: { id: { in: [postId] } },
					limit: 1,
				},
				signal,
			});
			return (
				data.items.find(
					(item): item is FeedPost => item.id === postId && item.itemType === "post",
				) ?? null
			);
		},
	});
}
