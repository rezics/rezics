import {
	getApiEntities,
	PostApiSearchByIndexIndex,
	postApiSearch,
	postApiSearchByIndex,
	postApiUnitsPresentations,
} from "@rezics/openapi-tanstack-query";
import type { ContentLanguage } from "@rezics/i18n";
import type { EntitySearch } from "@rezics/ui";

import { isUnitId } from "@/features/units/model/unit-id";

function isSearchIndex(index: string): index is PostApiSearchByIndexIndex {
	return Object.values(PostApiSearchByIndexIndex).some((candidate) => candidate === index);
}

function indexIncludesKind(index: string, kind: string): boolean {
	if (index === "all" || index === "units") return true;
	const kindsByIndex: Readonly<Record<string, readonly string[]>> = {
		users: ["profile"],
		entities: ["entity"],
		tags: ["tag"],
		"tag-structures": ["structure"],
		posts: ["post"],
		realms: ["realm"],
		collections: ["collection"],
		reviews: ["post"],
		polls: ["poll"],
	};
	return kindsByIndex[index]?.includes(kind) ?? false;
}

async function resolveExactUnit(
	index: string,
	query: string,
	signal: AbortSignal,
	localizationLanguages: readonly ContentLanguage[],
	kinds?: readonly string[],
) {
	if (!isUnitId(query)) return [];
	const { data } = await postApiUnitsPresentations({
		body: { ids: [query], localizationLanguages: [...localizationLanguages] },
		signal,
	});
	return data.items
		.filter(
			(item) => indexIncludesKind(index, item.kind) && (!kinds || kinds.includes(item.kind)),
		)
		.map((item) => ({
			id: item.id,
			label: item.title ?? item.id,
			kind: item.kind,
			avatar: item.avatar,
		}));
}

export function createEntitySearch(
	localizationLanguages: readonly ContentLanguage[],
): EntitySearch {
	return async (index, query, signal, options) => {
		if (index === "entities" && options?.creditAttributionSearch) {
			const { data } = await getApiEntities({
				query: {
					creditAttributionSearch: options.creditAttributionSearch,
					query,
					limit: 10,
					localizationLanguages: [...localizationLanguages],
				},
				signal,
			});
			return data.items.map((item) => ({
				id: item.id,
				label: item.title ?? item.id,
				kind: item.kind,
				avatar: item.avatar,
			}));
		}
		const exact = await resolveExactUnit(
			index,
			query,
			signal,
			localizationLanguages,
			options?.kinds,
		);
		if (exact.length) return exact;
		if (index === "all") {
			const { data } = await postApiSearch({
				body: {
					query,
					limitPerIndex: 3,
					localizationLanguages: [...localizationLanguages],
				},
				signal,
			});
			const byId = new Map(
				data.groups
					.flatMap((group) =>
						group.hits.map((hit) => ({
							id: hit.id,
							label: hit.title ?? hit.name ?? hit.id,
							kind: hit.kind,
							avatar: hit.avatar,
						})),
					)
					.map((hit) => [hit.id, hit] as const),
			);
			return [...byId.values()].slice(0, 20);
		}
		if (!isSearchIndex(index)) return [];
		const { data } = await postApiSearchByIndex({
			path: { index },
			body: {
				query,
				kinds: options?.kinds ? [...options.kinds] : undefined,
				limit: 10,
				localizationLanguages: [...localizationLanguages],
			},
			signal,
		});
		const byId = new Map(
			data.hits
				.map((hit) => ({
					id: hit.id,
					label: hit.title ?? hit.name ?? hit.id,
					kind: hit.kind,
					avatar: hit.avatar,
				}))
				.map((hit) => [hit.id, hit] as const),
		);
		return [...byId.values()].slice(0, 10);
	};
}
