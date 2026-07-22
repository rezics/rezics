import {
	compileSearchRequest,
	createSearchCursor,
	parseSearchCursor,
	type CompiledSearchRequest,
	type SearchConfiguration,
	type SearchControl,
	type SearchExpression,
	type SearchFilter,
} from "@rezics/search";
import { ZoneBoundaryDocument, parseDocument } from "@rezics/block";
import { eq } from "drizzle-orm";

import { database } from "../database";
import { zone } from "../database/schema";
import { InvalidSearch } from "./errors";
import { getActiveSearchGeneration } from "./generation";
import { SearchCategories, type SearchCategory } from "./schema";
import { searchDomain, searchDomainFacets } from "./service";

const modes = ["basic", "advanced"] as const;

function control(input: Omit<SearchControl, "modes"> & { modes?: SearchControl["modes"] }) {
	return { ...input, modes: input.modes ?? [...modes] } satisfies SearchControl;
}

export const GlobalSearchConfiguration = {
	scope: { kind: "global" },
	categories: [...SearchCategories],
	modes: { available: [...modes], default: "basic" },
	query: { enabled: true },
	constraints: [],
	defaults: [],
	controls: [
		control({
			key: "category",
			field: "category",
			component: "multi-select",
			operators: ["any-of", "none-of"],
			optionSource: {
				kind: "static",
				options: SearchCategories.map((value) => ({ value })),
			},
		}),
		control({
			key: "language",
			field: "language",
			component: "multi-select",
			operators: ["any-of", "all-of", "none-of"],
			optionSource: { kind: "facet" },
		}),
		control({
			key: "kind",
			field: "kind",
			component: "multi-select",
			operators: ["any-of", "none-of"],
			optionSource: { kind: "facet" },
		}),
		control({
			key: "content-rating",
			field: "content-rating",
			component: "multi-select",
			operators: ["any-of", "none-of"],
			optionSource: {
				kind: "static",
				options: ["general", "r15", "r18", "r18g"].map((value) => ({ value })),
			},
		}),
		control({
			key: "ai-disclosure",
			field: "ai-disclosure",
			component: "multi-select",
			operators: ["any-of", "none-of"],
			optionSource: {
				kind: "static",
				options: [
					"unknown",
					"none",
					"ai_assisted",
					"ai_originated",
					"machine_generated",
				].map((value) => ({ value })),
			},
			modes: ["advanced"],
		}),
		control({
			key: "license",
			field: "license",
			component: "multi-select",
			operators: ["any-of", "none-of", "exists"],
			optionSource: { kind: "facet" },
			modes: ["advanced"],
		}),
		control({
			key: "tag",
			field: "tag",
			component: "multi-select",
			operators: ["any-of", "all-of", "none-of"],
			optionSource: { kind: "facet" },
			modes: ["advanced"],
		}),
		...(["publisher", "realm", "subject", "target", "root", "parent", "owner"] as const).map(
			(field) =>
				control({
					key: field,
					field,
					component: "select",
					operators: ["equals", "not-equals"],
					optionSource: { kind: "facet" },
					modes: ["advanced"],
				}),
		),
		...(["created-at", "updated-at", "published-at", "closes-at"] as const).map((field) =>
			control({
				key: field,
				field,
				component: "date-range",
				operators: ["range", "exists"],
				modes: ["advanced"],
			}),
		),
		control({
			key: "join-policy",
			field: "join-policy",
			component: "multi-select",
			operators: ["any-of", "none-of"],
			optionSource: {
				kind: "static",
				options: ["open", "approval"].map((value) => ({ value })),
			},
			modes: ["advanced"],
		}),
		control({
			key: "multiple",
			field: "multiple",
			component: "toggle",
			operators: ["equals", "not-equals"],
			modes: ["advanced"],
		}),
		control({
			key: "results-visibility",
			field: "results-visibility",
			component: "multi-select",
			operators: ["any-of", "none-of"],
			optionSource: {
				kind: "static",
				options: ["live", "after_close"].map((value) => ({ value })),
			},
			modes: ["advanced"],
		}),
		control({
			key: "closed",
			field: "closed",
			component: "toggle",
			operators: ["equals", "not-equals"],
			modes: ["advanced"],
		}),
	],
	sort: {
		default: "relevance",
		options: [
			"relevance",
			"createdAt:asc",
			"createdAt:desc",
			"updatedAt:asc",
			"updatedAt:desc",
		],
	},
	results: {
		pageSize: 20,
		maxPageSize: 50,
		maxResultWindow: 10_000,
		facets: ["category", "language", "kind", "content-rating", "tag"],
	},
} satisfies SearchConfiguration;

function combineFilters(filters: readonly SearchFilter[]): SearchExpression | undefined {
	if (!filters.length) return undefined;
	return filters.length === 1 ? filters[0] : { operator: "all", clauses: [...filters] };
}

function combineExpressions(
	left: SearchExpression | undefined,
	right: SearchExpression | undefined,
): SearchExpression | undefined {
	if (!left) return right;
	if (!right) return left;
	return { operator: "all", clauses: [left, right] };
}

async function resolveScope(compiled: CompiledSearchRequest): Promise<{
	categories: SearchCategory[];
	filters: SearchFilter[];
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
		filters: boundary.filters,
	};
}

export async function executeConfiguredSearch(
	trustedConfiguration: SearchConfiguration,
	request: unknown,
	profileId?: string,
	enforcedZoneId?: string,
) {
	let compiled: CompiledSearchRequest;
	try {
		compiled = compileSearchRequest(trustedConfiguration, request);
	} catch (cause) {
		throw new InvalidSearch(cause instanceof Error ? cause.message : "Invalid Search input");
	}
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
	const fixedExpression = combineFilters([...compiled.constraints, ...scope.filters]);
	const expression = combineExpressions(fixedExpression, compiled.expression);
	const generation = await getActiveSearchGeneration("current");
	const requestHash = createHash("sha256")
		.update(
			JSON.stringify({
				scope,
				categories: scope.categories,
				query: compiled.query.trim(),
				sort: compiled.sort,
				expression,
				facets: compiled.facets,
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
						expression,
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
	const hasNext = groups.some((group) => !group.exhausted);
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
import { createHash } from "node:crypto";
