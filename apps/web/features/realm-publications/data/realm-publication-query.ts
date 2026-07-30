"use client";

import {
	getApiUnitsByIdByUnitIdRealmPublications,
	getApiUnitsByIdByUnitIdRealmPublicationsQueryKey,
	type GetApiUnitsByIdByUnitIdRealmPublicationsPublicationState,
	type GetApiUnitsByIdByUnitIdRealmPublicationsQuery,
	type GetApiUnitsByIdByUnitIdRealmPublicationsRealmStatus,
	type GetApiUnitsByIdByUnitIdRealmPublicationsStatus200,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";

import { useLocalizationLanguages } from "@/i18n/use-localization-languages";

export type RealmPublicationStateFilter = GetApiUnitsByIdByUnitIdRealmPublicationsPublicationState;
export type RealmGovernanceStateFilter = GetApiUnitsByIdByUnitIdRealmPublicationsRealmStatus;
export type RealmPublicationPage = GetApiUnitsByIdByUnitIdRealmPublicationsStatus200;
export type RealmPublicationItem = RealmPublicationPage["items"][number];
export type RealmPublicationPages = InfiniteData<RealmPublicationPage>;

export const RealmPublicationPageSize = 30;

export function useUnitRealmPublications(
	unitId: string,
	publicationState: RealmPublicationStateFilter,
	realmStatus: RealmGovernanceStateFilter,
) {
	const localizationLanguages = useLocalizationLanguages();
	const baseQuery = {
		localizationLanguages,
		publicationState,
		realmStatus,
		limit: RealmPublicationPageSize,
	} satisfies GetApiUnitsByIdByUnitIdRealmPublicationsQuery;
	const query = useInfiniteQuery({
		queryKey: getApiUnitsByIdByUnitIdRealmPublicationsQueryKey({
			path: { unitId },
			query: baseQuery,
		}),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiUnitsByIdByUnitIdRealmPublications({
				path: { unitId },
				query: {
					...baseQuery,
					...(pageParam ? { cursor: pageParam } : {}),
				},
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	return { ...query, baseQuery };
}

export function realmPublicationItems(
	data: RealmPublicationPages | undefined,
): RealmPublicationItem[] {
	const byRealm = new Map<string, RealmPublicationItem>();
	for (const page of data?.pages ?? [])
		for (const item of page.items) byRealm.set(item.realmId, item);
	return [...byRealm.values()];
}
