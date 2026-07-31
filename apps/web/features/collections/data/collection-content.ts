"use client";

import {
	getApiCollectionsByCollectionIdItems,
	type GetApiCollectionsByCollectionIdItemsStatus200,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery, type QueryClient } from "@tanstack/react-query";
import type { ContentLanguage } from "@rezics/i18n";

import { collectUniqueFeedItems } from "@/features/content-feed/model/feed-items";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";

export type CollectionContentItem = GetApiCollectionsByCollectionIdItemsStatus200["items"][number];

export const CollectionContentQueryKey = ["collections", "content"] as const;

export async function fetchCollectionContentPage(input: {
	readonly collectionId: string;
	readonly cursor?: string;
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly signal: AbortSignal;
}) {
	const { data } = await getApiCollectionsByCollectionIdItems({
		path: { collectionId: input.collectionId },
		query: {
			limit: 50,
			localizationLanguages: [...input.localizationLanguages],
			...(input.cursor ? { cursor: input.cursor } : {}),
		},
		signal: input.signal,
		throwOnError: true,
	});
	return data;
}

export function useCollectionContent(collectionId: string, enabled = true) {
	const localizationLanguages = useLocalizationLanguages();
	return useInfiniteQuery({
		queryKey: [...CollectionContentQueryKey, collectionId, localizationLanguages],
		queryFn: ({ pageParam, signal }) =>
			fetchCollectionContentPage({
				collectionId,
				cursor: pageParam || undefined,
				localizationLanguages,
				signal,
			}),
		enabled,
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
}

export function collectionContentItems(
	query: ReturnType<typeof useCollectionContent>,
): CollectionContentItem[] {
	return collectUniqueFeedItems(query.data?.pages ?? [], (item) => item.membership.targetId);
}

export async function invalidateCollectionContent(queryClient: QueryClient, collectionId?: string) {
	await queryClient.resetQueries({
		queryKey: collectionId
			? [...CollectionContentQueryKey, collectionId]
			: CollectionContentQueryKey,
	});
}
