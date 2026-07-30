import {
	getApiChaptersByChapterIdQueryKey,
	getApiUnitsBookByUnitIdContentStructureNodesQueryKey,
	getApiUnitsMediaByUnitIdContentStructureNodesQueryKey,
	getApiUnitsByTypeByUnitIdQueryKey,
	getApiUnitsByTypeQueryKey,
} from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";

import { isCatalogUnitType, type UnitType } from "./unit-types";

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
		...(includeList && isCatalogUnitType(type)
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

export async function invalidateMediaContentStructure(queryClient: QueryClient, mediaId: string) {
	await queryClient.invalidateQueries({
		queryKey: getApiUnitsMediaByUnitIdContentStructureNodesQueryKey({
			path: { unitId: mediaId },
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
