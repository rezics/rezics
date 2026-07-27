"use client";

import {
	getApiCollectionsByCollectionIdItems,
	type GetApiCollectionsByCollectionIdItemsStatus200,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery, type QueryClient } from "@tanstack/react-query";

import { useLocalizationLanguages } from "@/i18n/use-localization-languages";

export type CollectionContentItem = GetApiCollectionsByCollectionIdItemsStatus200["items"][number];

export const CollectionContentQueryKey = ["collections", "content"] as const;

export function useCollectionContent(collectionId: string, enabled = true) {
	const localizationLanguages = useLocalizationLanguages();
	return useInfiniteQuery({
		queryKey: [...CollectionContentQueryKey, collectionId, localizationLanguages],
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiCollectionsByCollectionIdItems({
				path: { collectionId },
				query: {
					limit: 50,
					localizationLanguages,
					...(pageParam ? { cursor: pageParam } : {}),
				},
				signal,
			});
			return data;
		},
		enabled,
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
}

export function collectionContentItems(
	query: ReturnType<typeof useCollectionContent>,
): CollectionContentItem[] {
	return query.data?.pages.flatMap((page) => page.items) ?? [];
}

export async function invalidateCollectionContent(queryClient: QueryClient, collectionId?: string) {
	await queryClient.resetQueries({
		queryKey: collectionId
			? [...CollectionContentQueryKey, collectionId]
			: CollectionContentQueryKey,
	});
}
