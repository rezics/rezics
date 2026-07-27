"use client";

import {
	getApiRealmsByRealmIdUnits,
	getApiRealmsByRealmIdUnitsByUnitIdHistoryQueryKey,
	getApiRealmsByRealmIdUnitsQueryKey,
	type GetApiRealmsByRealmIdUnitsQuery,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery, type QueryClient } from "@tanstack/react-query";

import { invalidatePostQueries } from "@/features/posts/query";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import {
	AllRealmModerationStatuses,
	type RealmModerationFilter,
} from "../routing/realm-moderation-route";
import {
	updateRealmModerationPages,
	type RealmModerationPages,
	type RealmModerationTarget,
} from "../model/realm-moderation-cache";

export const RealmModerationPageSize = 30;
export const RealmModerationHistoryQuery = { limit: 100 } as const;

export type {
	RealmModerationPage,
	RealmModerationTarget,
	RealmModerationUnit,
} from "../model/realm-moderation-cache";

export function useRealmModerationQueue(realmId: string, filter: RealmModerationFilter) {
	const localizationLanguages = useLocalizationLanguages();
	const baseQuery = {
		localizationLanguages,
		limit: RealmModerationPageSize,
		...(filter === AllRealmModerationStatuses ? {} : { status: filter }),
	} satisfies GetApiRealmsByRealmIdUnitsQuery;

	const queue = useInfiniteQuery({
		queryKey: getApiRealmsByRealmIdUnitsQueryKey({
			path: { realmId },
			query: baseQuery,
		}),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiRealmsByRealmIdUnits({
				path: { realmId },
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	return { ...queue, baseQuery };
}

export function updateRealmModerationQueueCache(
	queryClient: QueryClient,
	realmId: string,
	query: GetApiRealmsByRealmIdUnitsQuery,
	filter: RealmModerationFilter,
	unitId: string,
	target: RealmModerationTarget,
): void {
	queryClient.setQueryData<RealmModerationPages>(
		getApiRealmsByRealmIdUnitsQueryKey({ path: { realmId }, query }),
		(data) => updateRealmModerationPages(data, unitId, target, filter),
	);
}

export function refreshRealmModerationData(
	queryClient: QueryClient,
	realmId: string,
	unitId: string,
): void {
	void Promise.all([
		queryClient.invalidateQueries({
			queryKey: getApiRealmsByRealmIdUnitsQueryKey({ path: { realmId } }),
		}),
		queryClient.invalidateQueries({
			queryKey: getApiRealmsByRealmIdUnitsByUnitIdHistoryQueryKey({
				path: { realmId, unitId },
				query: RealmModerationHistoryQuery,
			}),
		}),
		invalidatePostQueries(queryClient, unitId),
	]);
}
