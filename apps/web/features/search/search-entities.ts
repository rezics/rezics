import {
	PostApiSearchByIndexIndex,
	postApiSearch,
	postApiSearchByIndex,
} from "@rezics/openapi-tanstack-query";
import type { EntitySearch } from "@rezics/ui";

function isSearchIndex(index: string): index is PostApiSearchByIndexIndex {
	return Object.values(PostApiSearchByIndexIndex).some((candidate) => candidate === index);
}

export const searchEntities: EntitySearch = async (index, query, signal) => {
	if (index === "all") {
		const { data } = await postApiSearch({
			body: { query, limitPerIndex: 3 },
			signal,
		});
		const byId = new Map(
			data.groups.flatMap((group) =>
				group.hits.map(
					(hit) =>
						[
							hit.id,
							{
								id: hit.id,
								label: hit.titles[0] ?? hit.name ?? hit.id,
								kind: hit.kind,
								avatar: hit.avatar,
							},
						] as const,
				),
			),
		);
		return [...byId.values()].slice(0, 20);
	}
	if (!isSearchIndex(index)) return [];
	const { data } = await postApiSearchByIndex({
		path: { index },
		body: { query, limit: 10 },
		signal,
	});
	return data.hits.map((hit) => ({
		id: hit.id,
		label: hit.titles[0] ?? hit.name ?? hit.id,
		kind: hit.kind,
		avatar: hit.avatar,
	}));
};
