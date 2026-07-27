import {
	getApiCollectionsByCollectionIdQueryKey,
	getApiCollectionsFavoritesQueryKey,
	getApiCollectionsQueryKey,
} from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";

import { invalidateCollectionContent } from "./collection-content";

export async function invalidateCollections(queryClient: QueryClient, collectionId?: string) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: getApiCollectionsQueryKey() }),
		queryClient.invalidateQueries({ queryKey: getApiCollectionsFavoritesQueryKey() }),
		invalidateCollectionContent(queryClient, collectionId),
		...(collectionId
			? [
					queryClient.invalidateQueries({
						queryKey: getApiCollectionsByCollectionIdQueryKey({
							path: { collectionId },
						}),
					}),
				]
			: []),
	]);
}
