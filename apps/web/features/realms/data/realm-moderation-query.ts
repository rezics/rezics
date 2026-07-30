"use client";

import {
	getApiRealmsByRealmIdUnits,
	getApiRealmsByRealmIdUnitsByUnitIdHistoryQueryKey,
	getApiRealmsByRealmIdReportsQueryKey,
	getApiRealmsByRealmIdUnitsQueryKey,
	type GetApiRealmsByRealmIdUnitsQuery,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery, type QueryClient } from "@tanstack/react-query";

import { invalidatePostQueries } from "@/features/posts/query";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import {
	ReportedRealmUnits,
	type RealmPublicationFilter,
	type RealmReportFilter,
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

export function useRealmModerationQueue(
	realmId: string,
	filter: RealmModerationFilter,
	publicationFilter: RealmPublicationFilter,
	reportFilter: RealmReportFilter,
) {
	const localizationLanguages = useLocalizationLanguages();
	const baseQuery = {
		localizationLanguages,
		limit: RealmModerationPageSize,
		status: filter,
		publicationState: publicationFilter,
		...(reportFilter === ReportedRealmUnits ? { reported: true } : {}),
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
	reportFilter: RealmReportFilter,
	unitId: string,
	target: RealmModerationTarget,
): void {
	queryClient.setQueryData<RealmModerationPages>(
		getApiRealmsByRealmIdUnitsQueryKey({ path: { realmId }, query }),
		(data) => updateRealmModerationPages(data, unitId, target, filter, reportFilter),
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
		queryClient.invalidateQueries({
			queryKey: getApiRealmsByRealmIdReportsQueryKey({
				path: { realmId },
				query: { unitId, limit: 100 },
			}),
		}),
		invalidatePostQueries(queryClient, unitId),
	]);
}
