import {
	getApiChaptersByChapterIdQueryKey,
	getApiUnitsBookByUnitIdContentStructureNodesQueryKey,
	getApiUnitsByTypeByUnitIdQueryKey,
	getApiUnitsByTypeQueryKey,
} from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";
import type { ContentLanguage } from "@rezics/i18n";

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

export async function invalidateChapterContent(
	queryClient: QueryClient,
	chapterId: string,
	language: ContentLanguage,
) {
	await queryClient.invalidateQueries({
		queryKey: getApiChaptersByChapterIdQueryKey({
			path: { chapterId },
			query: { language },
		}),
	});
}
