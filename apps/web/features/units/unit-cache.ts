import {
	getApiChaptersByChapterIdQueryKey,
	getApiUnitsBookByUnitIdContentStructureNodesQueryKey,
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

export async function invalidateBookContentStructure(queryClient: QueryClient, bookId: string) {
	await queryClient.invalidateQueries({
		queryKey: getApiUnitsBookByUnitIdContentStructureNodesQueryKey({
			path: { unitId: bookId },
		}),
	});
}

export async function invalidateChapterContent(queryClient: QueryClient, chapterId: string) {
	await queryClient.invalidateQueries({
		queryKey: getApiChaptersByChapterIdQueryKey({
			path: { chapterId },
		}),
	});
}

export async function invalidateChapter(queryClient: QueryClient, chapterId: string) {
	await invalidateChapterContent(queryClient, chapterId);
}
