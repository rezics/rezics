import {
	getApiPostsByPostIdQueryKey,
	listTextVersionContentNodesQueryKey,
	listProgramContentNodesQueryKey,
	getApiUnitsByTypeByUnitIdQueryKey,
	getApiUnitsByTypeQueryKey,
} from "@rezics/openapi-tanstack-query";
import type { QueryClient } from "@tanstack/react-query";

import { type UnitType } from "./unit-types";

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
		queryKey: listTextVersionContentNodesQueryKey({
			path: { unitId: bookId },
		}),
	});
}

export async function invalidateMediaContentStructure(queryClient: QueryClient, mediaId: string) {
	await queryClient.invalidateQueries({
		queryKey: listProgramContentNodesQueryKey({
			path: { unitId: mediaId },
		}),
	});
}

export async function invalidateChapterContent(queryClient: QueryClient, chapterId: string) {
	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: getApiPostsByPostIdQueryKey({ path: { postId: chapterId } }),
		}),
		queryClient.invalidateQueries({
			queryKey: [{ url: "/api/v1/publishing/text-versions/:bookId/content-nodes/:nodeId" }],
		}),
		queryClient.invalidateQueries({
			queryKey: [{ url: "/api/v1/publishing/text-versions/:unitId/content-structure/nodes" }],
		}),
	]);
}

export async function invalidateChapter(queryClient: QueryClient, chapterId: string) {
	await invalidateChapterContent(queryClient, chapterId);
}
