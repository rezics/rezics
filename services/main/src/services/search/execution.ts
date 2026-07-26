import { createHash } from "node:crypto";

import {
	canonicalUnitPredicate,
	combineUnitPredicates,
	type SearchControlPredicate,
	type UnitPredicate,
} from "@rezics/filter";
import { ZoneBoundaryDocument, parseDocument } from "@rezics/block";
import { eq } from "drizzle-orm";

import { database } from "../database";
import { zone } from "../database/schema";
import { InvalidSearch } from "./errors";
import { getActiveSearchGeneration } from "./generation";
import {
	assertSearchExpression,
	combineSearchExpressions,
	createSearchCursor,
	parseSearchCursor,
	type CompiledSearchRequest,
} from "./query";
import type { SearchCategory } from "./schema";
import { searchDomain, searchDomainFacets } from "./service";

async function resolveScope(compiled: CompiledSearchRequest): Promise<{
	categories: SearchCategory[];
	filters: SearchControlPredicate[];
	domainFilter?: UnitPredicate;
	scopeUnitId?: string;
	includeScopeDescendants?: boolean;
}> {
	if (compiled.scope.kind === "global")
		return { categories: [...compiled.categories], filters: [] };
	if (compiled.scope.kind === "realm")
		return {
			categories: [...compiled.categories],
			filters: [{ field: "realm", operator: "equals", value: compiled.scope.realmId }],
		};
	if (compiled.scope.kind === "unit")
		return {
			categories: [...compiled.categories],
			filters: [],
			scopeUnitId: compiled.scope.unitId,
			includeScopeDescendants: compiled.scope.includeDescendants,
		};

	const [record] = await database
		.select({ boundaryDocument: zone.boundaryDocument })
		.from(zone)
		.where(eq(zone.id, compiled.scope.zoneId))
		.limit(1);
	if (!record) throw new InvalidSearch("Search Zone scope does not exist");
	const boundary = parseDocument(ZoneBoundaryDocument, record.boundaryDocument);
	return {
		categories: compiled.categories.filter((category) =>
			boundary.categories.includes(category),
		),
		filters: [],
		...(boundary.filter ? { domainFilter: boundary.filter } : {}),
	};
}

/** Executes an already proven, engine-independent Filter request. */
export async function executeCompiledSearch(
	compiled: CompiledSearchRequest,
	profileId?: string,
	enforcedZoneId?: string,
	inputIdentity?: string,
) {
	const configuredScope = await resolveScope(compiled);
	const hostScope = enforcedZoneId
		? await resolveScope({
				...compiled,
				scope: { kind: "zone", zoneId: enforcedZoneId },
			})
		: undefined;
	const scope = {
		categories: hostScope
			? configuredScope.categories.filter((category) =>
					hostScope.categories.includes(category),
				)
			: configuredScope.categories,
		filters: [...configuredScope.filters, ...(hostScope?.filters ?? [])],
		scopeUnitId: configuredScope.scopeUnitId,
		includeScopeDescendants: configuredScope.includeScopeDescendants,
	};
	const searchExpression = combineSearchExpressions("all", [
		...compiled.constraints,
		...scope.filters,
		...(compiled.searchExpression ? [compiled.searchExpression] : []),
	]);
	if (searchExpression) assertSearchExpression(searchExpression, { maxDepth: 6, maxNodes: 100 });
	const domainFilter = combineUnitPredicates([
		compiled.domainFilter,
		configuredScope.domainFilter,
		hostScope?.domainFilter,
	]);
	const generation = await getActiveSearchGeneration("current");
	const requestHash = createHash("sha256")
		.update(
			JSON.stringify({
				scope,
				categories: scope.categories,
				query: compiled.query.trim(),
				sort: compiled.sort,
				maxResultWindow: compiled.maxResultWindow,
				searchExpression,
				domainFilter: domainFilter ? canonicalUnitPredicate(domainFilter) : undefined,
				facets: compiled.facets,
				inputIdentity,
			}),
		)
		.digest("hex");
	let cursor: ReturnType<typeof parseSearchCursor> | undefined;
	if (compiled.cursor)
		try {
			cursor = parseSearchCursor(compiled.cursor);
		} catch (cause) {
			throw new InvalidSearch(
				cause instanceof Error ? cause.message : "Invalid Search cursor",
			);
		}
	if (
		cursor &&
		(cursor.generationId !== generation.id ||
			cursor.requestHash !== requestHash ||
			cursor.pageSize !== compiled.pageSize)
	)
		throw new InvalidSearch("Search cursor does not match this generation or request");
	if (
		cursor &&
		Object.values(cursor.categories).some(
			(category) => category.offset >= compiled.maxResultWindow,
		)
	)
		throw new InvalidSearch("Search cursor exceeds the configured result window");
	const results = (
		await Promise.all(
			scope.categories.map(async (category) => {
				try {
					const domainRequest = {
						profileId,
						query: compiled.query,
						offset: cursor?.categories[category]?.offset ?? 0,
						limit: compiled.pageSize,
						sort: compiled.sort,
						searchExpression,
						domainFilter,
						scopeUnitId: scope.scopeUnitId,
						includeScopeDescendants: scope.includeScopeDescendants,
					};
					const [group, facets] = await Promise.all([
						searchDomain(category, domainRequest),
						searchDomainFacets(category, domainRequest, compiled.facets),
					]);
					return {
						group: { index: category, ...group },
						facets,
					};
				} catch (cause) {
					if (cause instanceof InvalidSearch) return null;
					throw cause;
				}
			}),
		)
	).filter((result): result is NonNullable<typeof result> => result !== null);
	if (!results.length && scope.categories.length)
		throw new InvalidSearch("No selected Search category supports this filter combination");
	const groups = results.map((result) => result.group);
	const facetCounts = new Map<
		string,
		Map<string, { value: number; relation: "exact" | "lower-bound" }>
	>();
	for (const result of results)
		for (const facet of result.facets) {
			const options =
				facetCounts.get(facet.field) ??
				new Map<string, { value: number; relation: "exact" | "lower-bound" }>();
			for (const option of facet.options) {
				const existing = options.get(option.value);
				options.set(option.value, {
					value: (existing?.value ?? 0) + option.count.value,
					relation:
						existing?.relation === "lower-bound" ||
						option.count.relation === "lower-bound"
							? "lower-bound"
							: "exact",
				});
			}
			facetCounts.set(facet.field, options);
		}
	const facets = compiled.facets.flatMap((field) => {
		const options = facetCounts.get(field);
		if (!options) return [];
		return [
			{
				field,
				options: [...options]
					.map(([value, count]) => ({ value, count }))
					.sort(
						(left, right) =>
							right.count.value - left.count.value ||
							left.value.localeCompare(right.value),
					)
					.slice(0, 100),
			},
		];
	});
	const hasNext =
		groups.some((group) => !group.exhausted) &&
		groups.every((group) => group.exhausted || group.nextOffset < compiled.maxResultWindow);
	const categories = Object.fromEntries(
		groups.map((group) => [
			group.index,
			{ offset: group.nextOffset, exhausted: group.exhausted },
		]),
	);
	return {
		query: compiled.query,
		groups,
		facets,
		nextCursor: hasNext
			? createSearchCursor({
					version: 2,
					generationId: generation.id,
					requestHash,
					pageSize: compiled.pageSize,
					categories,
				})
			: undefined,
	};
}
