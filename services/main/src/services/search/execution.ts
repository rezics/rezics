import { createHash } from "node:crypto";

import {
	canonicalUnitPredicate,
	combineUnitPredicates,
	type SearchControlPredicate,
	type SearchField,
	type UnitPredicate,
} from "@rezics/filter";
import { ZoneBoundaryDocument, parseDocument } from "@rezics/block";
import { getActiveObservability } from "@rezics/observability";
import type { ContentLanguage } from "@rezics/i18n";
import { eq } from "drizzle-orm";

import { database } from "../database";
import { zone } from "../database/schema";
import type { SearchCountResult } from "../counts/contract";
import { InvalidSearch } from "./errors";
import { getActiveSearchGeneration } from "./generation";
import { createCandidateSearchContext, type CandidateSearchContext } from "./meilisearch";
import {
	assertSearchExpression,
	combineSearchExpressions,
	createGlobalSearchCursor,
	createSearchCursor,
	GlobalSearchCursorVersion,
	parseGlobalSearchCursor,
	parseSearchCursor,
	specializeSearchExpressionForCategory,
	type CompiledGlobalSearchRequest,
	type CompiledGroupedSearchRequest,
	type CompiledSearchRequest,
	type GroupedSearchCursorToken,
} from "./query";
import type { ValidatedSearchPlan } from "./validated-plan";
import type { SearchCategory } from "./schema";
import {
	searchDomain,
	searchDomainFacets,
	searchGlobalIdentifiers,
	validateSearchDomainRequest,
	type SearchFacet,
} from "./service";

const { logger } = getActiveObservability();

interface RankedSearchHit {
	readonly id: string;
}

interface RankedSearchGroup<Hit extends RankedSearchHit> {
	readonly hits: Hit[];
	readonly total: SearchCountResult;
	readonly offset: number;
	readonly nextOffset: number;
	readonly exhausted: boolean;
	readonly nextCursor?: GroupedSearchCursorToken;
	readonly limit: number;
	readonly processingTimeMs: number;
}

type DomainSearchExecutor<Hit extends RankedSearchHit> = (
	category: SearchCategory,
	request: Parameters<typeof searchDomain>[1],
	candidateContext: CandidateSearchContext,
) => Promise<RankedSearchGroup<Hit>>;

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

async function resolveCompiledExecution(
	compiled: CompiledSearchRequest,
	localizationLanguages: readonly ContentLanguage[],
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
				localizationLanguages,
				maxResultWindow: compiled.maxResultWindow,
				searchExpression,
				domainFilter: domainFilter ? canonicalUnitPredicate(domainFilter) : undefined,
				facets: compiled.facets,
				inputIdentity,
			}),
		)
		.digest("hex");
	return { scope, searchExpression, domainFilter, generation, requestHash };
}

function mergeSearchFacets(
	fields: readonly SearchField[],
	groups: readonly (readonly SearchFacet[])[],
) {
	const facetCounts = new Map<string, Map<string, SearchCountResult>>();
	for (const facets of groups)
		for (const facet of facets) {
			const options =
				facetCounts.get(facet.field) ?? new Map<string, SearchCountResult>();
			for (const option of facet.options) {
				const existing = options.get(option.value);
				options.set(option.value, {
					value: (existing?.value ?? 0) + option.count.value,
					kind:
						existing?.kind === "lower-bound" || option.count.kind === "lower-bound"
							? "lower-bound"
							: "exact",
				});
			}
			facetCounts.set(facet.field, options);
		}
	return fields.flatMap((field) => {
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
}

async function executeCompiledSearchWithPresentation<Hit extends RankedSearchHit>(
	compiled: CompiledGroupedSearchRequest,
	localizationLanguages: readonly ContentLanguage[],
	domainSearch: DomainSearchExecutor<Hit>,
	profileId?: string,
	enforcedZoneId?: string,
	inputIdentity?: string,
) {
	const { scope, searchExpression, domainFilter, generation, requestHash } =
		await resolveCompiledExecution(
			compiled,
			localizationLanguages,
			enforcedZoneId,
			inputIdentity,
		);
	const candidateContext = await createCandidateSearchContext(generation, profileId);
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
	const facetFields = cursor ? [] : compiled.facets;
	const outcomes = await Promise.all(
		scope.categories.map(async (category) => {
			try {
				const specializedExpression = searchExpression
					? specializeSearchExpressionForCategory(category, searchExpression)
					: undefined;
				if (specializedExpression?.state === "match-none")
					return { state: "skipped", category } as const;
				const domainRequest = {
					profileId,
					localizationLanguages,
					query: compiled.query,
					offset: cursor?.categories[category]?.offset ?? 0,
					limit: compiled.pageSize,
					sort: compiled.sort,
					...(specializedExpression?.state === "expression"
						? { searchExpression: specializedExpression.expression }
						: {}),
					domainFilter,
					scopeUnitId: scope.scopeUnitId,
					includeScopeDescendants: scope.includeScopeDescendants,
				};
				const [group, facets] = await Promise.all([
					domainSearch(category, domainRequest, candidateContext),
					searchDomainFacets(category, domainRequest, facetFields, candidateContext),
				]);
				return {
					state: "result",
					category,
					group: { index: category, ...group },
					facets,
				} as const;
			} catch (cause) {
				if (cause instanceof InvalidSearch)
					return {
						state: "invalid",
						category,
						reason: cause.message,
					} as const;
				throw cause;
			}
		}),
	);
	const results = outcomes.filter(
		(outcome): outcome is Extract<(typeof outcomes)[number], { readonly state: "result" }> =>
			outcome.state === "result",
	);
	if (!results.length && scope.categories.length)
		logger.warn("Search expression was rejected by every selected category", {
			eventName: "search.expression.unsupported",
			attributes: {
				failures: outcomes.flatMap((outcome) =>
					outcome.state === "invalid"
						? [{ category: outcome.category, reason: outcome.reason }]
						: [],
				),
			},
		});
	if (!results.length && scope.categories.length)
		throw new InvalidSearch("No selected Search category supports this filter combination");
	const groups = results.map((result) => result.group);
	const facets = mergeSearchFacets(
		compiled.facets,
		results.map((result) => result.facets),
	);
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
					version: 1,
					generationId: generation.id,
					requestHash,
					pageSize: compiled.pageSize,
					categories,
				})
			: undefined,
	};
}

/** Executes an already proven, engine-independent Filter request. */
export function executeCompiledSearch(
	plan: ValidatedSearchPlan<CompiledGroupedSearchRequest>,
	localizationLanguages: readonly ContentLanguage[],
	profileId?: string,
	enforcedZoneId?: string,
	inputIdentity?: string,
) {
	const { request: compiled } = plan;
	return executeCompiledSearchWithPresentation(
		compiled,
		localizationLanguages,
		searchDomain,
		profileId,
		enforcedZoneId,
		inputIdentity,
	);
}

/** @internal Executes one globally ranked Search Feed stream of Unit identities. */
export async function executeCompiledSearchIdentifiers(
	plan: ValidatedSearchPlan<CompiledGlobalSearchRequest>,
	localizationLanguages: readonly ContentLanguage[],
	profileId?: string,
	enforcedZoneId?: string,
	inputIdentity?: string,
) {
	const { request: compiled } = plan;
	const { scope, searchExpression, domainFilter, generation, requestHash } =
		await resolveCompiledExecution(
			compiled,
			localizationLanguages,
			enforcedZoneId,
			inputIdentity,
		);
	const candidateContext = await createCandidateSearchContext(generation, profileId);
	let cursor: ReturnType<typeof parseGlobalSearchCursor> | undefined;
	if (compiled.cursor)
		try {
			cursor = parseGlobalSearchCursor(compiled.cursor);
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
	if (cursor && cursor.offset >= compiled.maxResultWindow)
		throw new InvalidSearch("Search cursor exceeds the configured result window");

	const facetFields = cursor ? [] : compiled.facets;
	const outcomes = scope.categories.map((category) => {
		try {
			const specializedExpression = searchExpression
				? specializeSearchExpressionForCategory(category, searchExpression)
				: undefined;
			if (specializedExpression?.state === "match-none")
				return { state: "skipped", category } as const;
			const domainRequest = {
				profileId,
				localizationLanguages,
				query: compiled.query,
				limit: compiled.pageSize,
				sort: compiled.sort,
				...(specializedExpression?.state === "expression"
					? { searchExpression: specializedExpression.expression }
					: {}),
				domainFilter,
				scopeUnitId: scope.scopeUnitId,
				includeScopeDescendants: scope.includeScopeDescendants,
			};
			validateSearchDomainRequest(category, domainRequest);
			return { state: "result", category, request: domainRequest } as const;
		} catch (cause) {
			if (cause instanceof InvalidSearch)
				return {
					state: "invalid",
					category,
					reason: cause.message,
				} as const;
			throw cause;
		}
	});
	const results = outcomes.filter(
		(outcome): outcome is Extract<(typeof outcomes)[number], { readonly state: "result" }> =>
			outcome.state === "result",
	);
	if (!results.length && scope.categories.length)
		logger.warn("Search expression was rejected by every selected category", {
			eventName: "search.expression.unsupported",
			attributes: {
				failures: outcomes.flatMap((outcome) =>
					outcome.state === "invalid"
						? [{ category: outcome.category, reason: outcome.reason }]
						: [],
				),
			},
		});
	if (!results.length && scope.categories.length)
		throw new InvalidSearch("No selected Search category supports this filter combination");
	if (!results.length)
		return {
			query: compiled.query,
			hits: [],
			total: { kind: "exact" as const, value: 0 },
			facets: [],
			nextCursor: undefined,
		};

	const [page, facetGroups] = await Promise.all([
		searchGlobalIdentifiers(
			{
				profileId,
				localizationLanguages,
				query: compiled.query,
				offset: cursor?.offset ?? 0,
				limit: compiled.pageSize,
				sort: compiled.sort,
				domainFilter,
				scopeUnitId: scope.scopeUnitId,
				includeScopeDescendants: scope.includeScopeDescendants,
				branches: results.map((result) => ({
					category: result.category,
					...(result.request.searchExpression
						? { searchExpression: result.request.searchExpression }
						: {}),
				})),
			},
			candidateContext,
		),
		Promise.all(
			results.map((result) =>
				searchDomainFacets(result.category, result.request, facetFields, candidateContext),
			),
		),
	]);
	const hasNext = !page.exhausted && page.nextOffset < compiled.maxResultWindow;
	return {
		query: compiled.query,
		hits: page.hits,
		total: page.total,
		facets: mergeSearchFacets(compiled.facets, facetGroups),
		nextCursor: hasNext
			? createGlobalSearchCursor({
					version: GlobalSearchCursorVersion,
					generationId: generation.id,
					requestHash,
					pageSize: compiled.pageSize,
					offset: page.nextOffset,
				})
			: undefined,
	};
}
