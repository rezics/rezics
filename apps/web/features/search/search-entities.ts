import {
	getApiEntities,
	PostApiSearchByIndexIndex,
	postApiSearch,
	postApiSearchByIndex,
	postApiUnitsPresentations,
} from "@rezics/openapi-tanstack-query";
import type { ContentLanguage } from "@rezics/i18n";
import type { UnitOwner } from "@rezics/reference";
import type { EntitySearch, EntitySearchOptions } from "@rezics/ui";

import { isUnitId } from "@/features/units/model/unit-id";

function isSearchIndex(index: string): index is PostApiSearchByIndexIndex {
	return Object.values(PostApiSearchByIndexIndex).some((candidate) => candidate === index);
}

function matchesScope(
	item: { owner: UnitOwner; shape: string },
	options?: EntitySearchOptions,
): boolean {
	return (
		(!options?.owners || options.owners.includes(item.owner)) &&
		(!options?.shapes || options.shapes.includes(item.shape))
	);
}
function indexIncludesResource(index: string, owner: UnitOwner, shape: string): boolean {
	if (index === "all" || index === "units") return true;
	if (index === "reviews") return owner === "post" && shape === "review";
	const ownersByIndex: Readonly<Record<string, readonly UnitOwner[]>> = {
		users: ["entity"],
		entities: ["entity"],
		tags: ["tag"],
		"tag-paths": ["tag_path"],
		posts: ["post"],
		realms: ["realm"],
		collections: ["collection"],
		polls: ["poll"],
	};
	return ownersByIndex[index]?.includes(owner) ?? false;
}

async function resolveExactUnit(
	index: string,
	query: string,
	signal: AbortSignal,
	localizationLanguages: readonly ContentLanguage[],
	options?: EntitySearchOptions,
) {
	if (!isUnitId(query) || index === "users") return [];
	const { data } = await postApiUnitsPresentations({
		body: { ids: [query], localizationLanguages: [...localizationLanguages] },
		signal,
	});
	return data.items
		.filter(
			(item) => indexIncludesResource(index, item.owner, item.shape) && matchesScope(item, options),
		)
		.map((item) => ({
			id: item.id,
			label: item.title ?? item.id,
			owner: item.owner,
			shape: item.shape,
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
					...(query ? { query } : {}),
					limit: 10,
					localizationLanguages: [...localizationLanguages],
				},
				signal,
			});
			return data.items
				.filter((item) => matchesScope(item, options))
				.map((item) => ({
					id: item.id,
					label: item.title ?? item.id,
					owner: item.owner,
					shape: item.shape,
					avatar: item.avatar,
				}));
		}
		const exact = options?.realmTagContextRealmId
			? []
			: await resolveExactUnit(index, query, signal, localizationLanguages, options);
		if (exact.length) return exact;
		if (index === "all") {
			const { data } = await postApiSearch({
				body: {
					query,
					limitPerIndex: 3,
					owners: options?.owners ? [...options.owners] : undefined,
					shapes: options?.shapes ? [...options.shapes] : undefined,
					localizationLanguages: [...localizationLanguages],
				},
				signal,
			});
			const byId = new Map(
				data.groups
					.flatMap((group) =>
						group.hits
							.filter((hit) => matchesScope(hit, options))
							.map((hit) => ({
								id: hit.id,
								label: hit.title ?? hit.name ?? hit.id,
								owner: hit.owner,
								shape: hit.shape,
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
				owners: options?.owners ? [...options.owners] : undefined,
				shapes: options?.shapes ? [...options.shapes] : undefined,
				realmTagContextRealmId: options?.realmTagContextRealmId,
				limit: 10,
				localizationLanguages: [...localizationLanguages],
			},
			signal,
		});
		const byId = new Map(
			data.hits
				.filter((hit) => matchesScope(hit, options))
				.map((hit) => ({
					id: hit.id,
					label: hit.title ?? hit.name ?? hit.id,
					owner: hit.owner,
					shape: hit.shape,
					avatar: hit.avatar,
				}))
				.map((hit) => [hit.id, hit] as const),
		);
		return [...byId.values()].slice(0, 10);
	};
}
