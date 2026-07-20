import { PostApiSearchByIndexIndex, postApiSearchByIndex } from "@rezics/openapi-tanstack-query";
import type { EntitySearch } from "@rezics/ui";

function isSearchIndex(index: string): index is PostApiSearchByIndexIndex {
	return Object.values(PostApiSearchByIndexIndex).some((candidate) => candidate === index);
}

export const searchEntities: EntitySearch = async (index, query, signal) => {
	if (!isSearchIndex(index)) return [];
	const { data } = await postApiSearchByIndex({
		path: { index },
		body: { query, limit: 10 },
		signal,
	});
	return data.hits.map((hit) => ({
		id: hit.id,
		label: hit.titles[0] ?? hit.name ?? hit.id,
	}));
};
