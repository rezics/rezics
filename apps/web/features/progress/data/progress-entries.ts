"use client";

import {
	getApiProgressByUnitIdEntries,
	getApiProgressByUnitIdEntriesQueryKey,
	type GetApiProgressByUnitIdEntriesQuery,
} from "@rezics/openapi-tanstack-query";
import { useInfiniteQuery } from "@tanstack/react-query";

export function useProgressEntries(unitId: string) {
	const baseQuery = { limit: 30 } satisfies GetApiProgressByUnitIdEntriesQuery;
	return useInfiniteQuery({
		queryKey: getApiProgressByUnitIdEntriesQueryKey({
			path: { unitId },
			query: baseQuery,
		}),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiProgressByUnitIdEntries({
				path: { unitId },
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
}
