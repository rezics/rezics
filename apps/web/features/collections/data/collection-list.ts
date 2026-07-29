"use client";

import {
	getApiCollections,
	getApiCollectionsQueryKey,
	type GetApiCollectionsQuery,
	type GetApiCollectionsStatus200,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery } from "@tanstack/react-query";

import { useLocalizationLanguages } from "@/i18n/use-localization-languages";

export type CollectionListItem = GetApiCollectionsStatus200["items"][number];

export function useCollectionList({
	acceptsItemsOnly = false,
	editableOnly = false,
	enabled = true,
	publisherProfileId,
	search,
	targetId,
}: {
	readonly acceptsItemsOnly?: boolean;
	readonly editableOnly?: boolean;
	readonly enabled?: boolean;
	readonly publisherProfileId?: string;
	readonly search?: string;
	readonly targetId?: string;
}) {
	const localizationLanguages = useLocalizationLanguages();
	const normalizedSearch = search?.trim();
	const query = {
		limit: 50,
		localizationLanguages,
		...(acceptsItemsOnly ? { acceptsItemsOnly: true } : {}),
		...(editableOnly ? { editableOnly: true } : {}),
		...(publisherProfileId ? { publisherProfileId } : {}),
		...(normalizedSearch ? { search: normalizedSearch } : {}),
		...(targetId ? { targetId } : {}),
	} satisfies GetApiCollectionsQuery;

	return useInfiniteQuery({
		queryKey: getApiCollectionsQueryKey({ query }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiCollections({
				query: { ...query, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		enabled,
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
}

export function collectionListItems(query: ReturnType<typeof useCollectionList>) {
	return query.data?.pages.flatMap((page) => page.items) ?? [];
}
