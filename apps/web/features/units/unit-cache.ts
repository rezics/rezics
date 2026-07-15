import {
	getApiChaptersByChapterIdQueryKey,
	getApiUnitsBookByUnitIdContentNodesQueryKey,
	getApiUnitsByTypeByUnitIdQueryKey,
	getApiUnitsByTypeQueryKey,
} from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";

import type { UnitType } from "./unit-types";

export async function invalidateUnitDetail(
	queryClient: QueryClient,
	type: UnitType,
	unitId: string,
	includeList = false,
) {
	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: getApiUnitsByTypeByUnitIdQueryKey({ path: { type, unitId } }),
		}),
		...(includeList
			? [
					queryClient.invalidateQueries({
						queryKey: getApiUnitsByTypeQueryKey({ path: { type } }),
					}),
				]
			: []),
	]);
}

export async function invalidateBookContentTree(queryClient: QueryClient, bookId: string) {
	await queryClient.invalidateQueries({
		queryKey: getApiUnitsBookByUnitIdContentNodesQueryKey({ path: { unitId: bookId } }),
	});
}

export async function invalidateChapterContent(
	queryClient: QueryClient,
	chapterId: string,
	language: string,
) {
	await queryClient.invalidateQueries({
		queryKey: getApiChaptersByChapterIdQueryKey({
			path: { chapterId },
			query: { language },
		}),
	});
}
