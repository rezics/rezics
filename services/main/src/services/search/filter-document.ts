import {
	canonicalSearchFeatureInput,
	combineUnitPredicates,
	defaultSearchSort,
	filterDocumentControlField,
	isSearchSortAvailable,
	parseSearchFeatureInput,
	parseFilterDocument,
	type ResolvedSearchControl,
	type SearchControlExpression,
	type SearchControlValue,
	type FilterDocument,
	type SearchFeatureContext,
	type SearchFeatureInput,
	type SearchFeatureSurface,
	type SearchField,
	SearchFieldValues,
	type SearchControlPredicate,
	type SearchScalar,
	type SearchOptionPolicy,
	type SearchSortConfiguration,
	type SearchSort,
	SearchSortValues,
	unitFilterSearchQuery,
} from "@rezics/filter";
import type { ContentLanguage } from "@rezics/i18n";

import type { SearchCountResult } from "../counts/contract";
import { WorkPolicy } from "../performance/policy";

import { InvalidSearch } from "./errors";
import {
	assertCurrentSearchFieldScalar,
	assertCurrentSearchFilterValue,
	getCurrentSearchFieldDefinition,
	searchFilterValues,
	supportsCurrentSearchSort,
	type SearchFieldDefinition,
} from "./field-registry";
import {
	assertSearchExpression,
	combineSearchExpressions,
	specializeSearchExpressionForCategory,
	type CompiledGlobalSearchRequest,
	type CompiledGroupedSearchRequest,
	type CompiledSearchRequest,
	type SearchExpression,
} from "./query";
import { SearchCategories } from "./schema";
import { ValidatedSearchPlan } from "./validated-plan";

const CommonSorts = [
	"best",
	"relevance",
	"createdAt:asc",
	"createdAt:desc",
	"updatedAt:asc",
	"updatedAt:desc",
] as const;

export const ProgressSearchSorts = [
	"progressLastSeenAt:desc",
	"progressLastSeenAt:asc",
	"title:asc",
	"title:desc",
] as const satisfies readonly SearchSort[];
export type ProgressSearchSort = (typeof ProgressSearchSorts)[number];

const CreditedProfileCategories = getCurrentSearchFieldDefinition("credited-profile").categories;
export const SearchMaxResultWindow = WorkPolicy.search.maxResultWindow;

/** The only Search capability ceiling. Filter documents can only narrow it. */
const GlobalVisibleFields = new Set<SearchField>([
	"category",
	"kind",
	"language",
	"content-rating",
	"tag",
]);
const GlobalFacetFields = new Set<SearchField>([
	"category",
	"kind",
	"language",
	"content-rating",
	"tag",
]);

export interface SearchEndpointPolicy {
	readonly fields?: readonly SearchField[];
	readonly sorts?: readonly SearchSort[];
	readonly defaultSorts?: Readonly<{
		search: Readonly<{ emptyQuery: SearchSort; textQuery: SearchSort }>;
		feed: Readonly<{ emptyQuery: SearchSort; textQuery: SearchSort }>;
	}>;
	readonly facets?: readonly SearchField[];
}

const StaticOptions: Partial<Record<SearchField, readonly SearchScalar[]>> = {
	category: SearchCategories,
	"content-rating": ["general", "r15", "r18", "r18g"],
	"ai-disclosure": ["unknown", "none", "ai_assisted", "ai_originated", "machine_generated"],
};

function fieldDefinition(field: SearchField): SearchFieldDefinition {
	return getCurrentSearchFieldDefinition(field);
}

function componentFor(definition: SearchFieldDefinition): ResolvedSearchControl["component"] {
	if (definition.scalar === "realm-tag-vote") return "realm-tag-vote";
	if (definition.scalar === "boolean") return "toggle";
	if (definition.scalar === "date") return "date-range";
	if (definition.scalar === "integer") return "value-range";
	return "multi-select";
}

function optionSourceFor(
	field: SearchField,
	definition: SearchFieldDefinition,
	categories: readonly (typeof SearchCategories)[number][],
): ResolvedSearchControl["optionSource"] {
	const options =
		field === "category"
			? SearchCategories.filter((category) => categories.includes(category))
			: StaticOptions[field];
	if (options)
		return {
			kind: "static",
			options: options.map((value) => ({ value })),
		};
	return definition.facet === "none" ? undefined : { kind: "facet" };
}

function validateControlOptionPolicy(
	field: SearchField,
	optionPolicy: SearchOptionPolicy | undefined,
): void {
	if (!optionPolicy || optionPolicy.kind === "all") return;
	for (const value of optionPolicy.values) validateScalar(field, value);
}

function resolveControl(
	field: SearchField,
	key: string,
	categories: readonly (typeof SearchCategories)[number][],
	override: NonNullable<FilterDocument["controls"]>[number] | undefined,
): ResolvedSearchControl {
	const definition = fieldDefinition(field);
	validateControlOptionPolicy(field, override?.optionPolicy);
	const optionSource = optionSourceFor(field, definition, categories);
	return {
		key,
		field,
		component: componentFor(definition),
		operators: [...definition.operators],
		...(optionSource ? { optionSource } : {}),
		...(override?.optionPolicy ? { optionPolicy: override.optionPolicy } : {}),
		...(override?.labelUnitId ? { labelUnitId: override.labelUnitId } : {}),
		...(override?.required === undefined ? {} : { required: override.required }),
		enabled: override?.enabled ?? true,
		disclosure: override?.disclosure ?? (GlobalVisibleFields.has(field) ? "visible" : "hidden"),
	};
}

function genericSortsFor(categories: readonly (typeof SearchCategories)[number][]): SearchSort[] {
	return SearchSortValues.filter(
		(sort) =>
			(CommonSorts as readonly SearchSort[]).includes(sort) ||
			categories.every((category) => supportsCurrentSearchSort(category, sort)),
	);
}

function resolveSortConfiguration(
	categories: readonly (typeof SearchCategories)[number][],
	policy: SearchEndpointPolicy,
) {
	const searchOptions = [...(policy.sorts ?? genericSortsFor(categories))];
	const feedOptions = searchOptions.filter((sort) => sort !== "relevance");
	const defaults =
		policy.defaultSorts ??
		({
			search: { emptyQuery: "best", textQuery: "relevance" },
			feed: { emptyQuery: "best", textQuery: "best" },
		} as const);
	const configurations: readonly [
		SearchFeatureSurface,
		readonly SearchSort[],
		Readonly<{ emptyQuery: SearchSort; textQuery: SearchSort }>,
	][] = [
		["search", searchOptions, defaults.search],
		["feed", feedOptions, defaults.feed],
	];
	for (const [surface, options, fallback] of configurations) {
		if (!options.length) throw new InvalidSearch(`Search ${surface} has no available sort`);
		if (!options.includes(fallback.emptyQuery) || !options.includes(fallback.textQuery))
			throw new InvalidSearch(`Search ${surface} fallback is outside the endpoint policy`);
		if (fallback.emptyQuery === "relevance")
			throw new InvalidSearch(`Search ${surface} cannot use relevance without a query`);
	}
	return {
		search: { defaults: { ...defaults.search }, options: searchOptions },
		feed: { defaults: { ...defaults.feed }, options: feedOptions },
	};
}

/** Resolves a sparse Filter document against the one server-owned capability ceiling. */
export function resolveFilterDocument(
	documentValue: unknown,
	hasDevelopmentPreviewAccess: boolean,
	policy: SearchEndpointPolicy = {},
) {
	let filterDocument: FilterDocument;
	try {
		filterDocument = parseFilterDocument(documentValue);
	} catch (cause) {
		throw new InvalidSearch(cause instanceof Error ? cause.message : "Invalid Filter document");
	}
	const configuredCategories = filterDocument.categories ?? SearchCategories;
	const categories = configuredCategories.filter(
		(category) => hasDevelopmentPreviewAccess || category !== "tag-structures",
	);
	if (!categories.length) throw new InvalidSearch("Filter document has no available categories");
	const allowedFields = policy.fields ?? SearchFieldValues;
	const overrideByKey = new Map(
		(filterDocument.controls ?? []).map((control) => [control.key, control] as const),
	);
	const controls: ResolvedSearchControl[] = [];
	for (const field of allowedFields) {
		const definition = fieldDefinition(field);
		if (!definition.categories.some((category) => categories.includes(category))) continue;
		controls.push(resolveControl(field, field, categories, overrideByKey.get(field)));
		overrideByKey.delete(field);
	}
	for (const override of overrideByKey.values()) {
		const field = filterDocumentControlField(override);
		if (override.key === field)
			throw new InvalidSearch(`Filter control ${override.key} is unavailable for its categories`);
		if (!allowedFields.includes(field))
			throw new InvalidSearch(`Filter control ${override.key} is outside the endpoint policy`);
		const definition = fieldDefinition(field);
		if (!definition.categories.some((category) => categories.includes(category)))
			throw new InvalidSearch(`Filter control ${override.key} does not apply to its categories`);
		controls.push(resolveControl(field, override.key, categories, override));
	}
	if (controls.length > 50) throw new InvalidSearch("Filter document exceeds 50 resolved controls");
	return {
		filterDocument,
		categories,
		query: { enabled: true, required: false },
		sort: resolveSortConfiguration(categories, policy),
		controls,
	} as const;
}

function sameScalar(left: SearchScalar, right: SearchScalar): boolean {
	return typeof left === typeof right && left === right;
}

function validateScalar(field: SearchField, value: SearchScalar): void {
	assertCurrentSearchFieldScalar(field, value);
}

function validateFilterValue(filter: SearchControlPredicate): void {
	assertCurrentSearchFilterValue(filter);
}

function validateControlValue(
	value: SearchControlValue,
	control: ResolvedSearchControl | undefined,
): void {
	if (!control) throw new InvalidSearch(`Search control ${value.controlKey} is unavailable`);
	if (control.field !== value.filter.field)
		throw new InvalidSearch(`Search control ${control.key} field does not match its value`);
	if (!control.operators.includes(value.filter.operator))
		throw new InvalidSearch(`Search control ${control.key} does not allow this operator`);
	validateFilterValue(value.filter);
	const options = control.optionSource?.kind === "static" ? control.optionSource.options : null;
	if (
		options &&
		!searchFilterValues(value.filter).every((item) =>
			options.some((option) => sameScalar(option.value, item)),
		)
	)
		throw new InvalidSearch(`Search control ${control.key} uses an unknown option`);
	const policy = control.optionPolicy;
	if (
		policy &&
		policy.kind !== "all" &&
		!searchFilterValues(value.filter).every((item) => {
			const listed = policy.values.some((allowed) => sameScalar(allowed, item));
			return policy.kind === "include" ? listed : !listed;
		})
	)
		throw new InvalidSearch(`Search control ${control.key} uses a hidden option`);
}

function normalizeFilterExpression(filter: SearchControlPredicate): SearchExpression {
	if (filter.operator !== "all-of" && filter.operator !== "any-of" && filter.operator !== "none-of")
		return filter;
	const clauses = filter.values.map((value): SearchControlPredicate => {
		if (filter.operator === "none-of")
			return { field: filter.field, operator: "not-equals", value };
		return { field: filter.field, operator: "equals", value };
	});
	if (clauses.length === 1) return clauses[0]!;
	return combineSearchExpressions(filter.operator === "any-of" ? "any" : "all", clauses)!;
}

function unwrapExpression(
	expression: SearchControlExpression,
	controls: ReadonlyMap<string, ResolvedSearchControl>,
	used: Set<string>,
): SearchExpression {
	if ("controlKey" in expression) {
		validateControlValue(expression, controls.get(expression.controlKey));
		used.add(expression.controlKey);
		return normalizeFilterExpression(expression.filter);
	}
	if (expression.operator === "not")
		return {
			operator: "not",
			clause: unwrapExpression(expression.clause, controls, used),
		};
	const clauses = expression.clauses
		.map((clause) => unwrapExpression(clause, controls, used))
		.flatMap((clause) =>
			!("field" in clause) && clause.operator === expression.operator ? clause.clauses : [clause],
		);
	return combineSearchExpressions(expression.operator, clauses)!;
}

function scopeForContexts(contexts: readonly SearchFeatureContext[]) {
	const zone = contexts.find((context) => context.kind === "zone");
	const unit = contexts.find((context) => context.kind === "unit");
	const realm = contexts.find((context) => context.kind === "realm");
	const profile = contexts.find((context) => context.kind === "profile");
	return {
		scope: unit
			? {
					kind: "unit" as const,
					unitId: unit.unitId,
					includeDescendants: unit.includeDescendants,
				}
			: { kind: "global" as const },
		enforcedZoneId: zone?.zoneId,
		contextFilters: realm
			? ([{ field: "realm", operator: "equals", value: realm.realmId }] as const)
			: [],
		contextExpression: profile
			? ({
					operator: "any",
					clauses: [
						{
							operator: "all",
							clauses: [
								{
									field: "category",
									operator: "any-of",
									values: [...CreditedProfileCategories],
								},
								{
									field: "credited-profile",
									operator: "equals",
									value: profile.profileId,
								},
							],
						},
						{
							operator: "all",
							clauses: [
								{
									operator: "any",
									clauses: [
										{
											field: "category",
											operator: "equals",
											value: "realms",
										},
										{
											operator: "all",
											clauses: [
												{
													field: "category",
													operator: "equals",
													value: "units",
												},
												{
													field: "kind",
													operator: "equals",
													value: "zone",
												},
											],
										},
									],
								},
								{
									field: "owner",
									operator: "equals",
									value: profile.profileId,
								},
							],
						},
					],
				} satisfies SearchExpression)
			: undefined,
	};
}

function withoutCursor(input: SearchFeatureInput): SearchFeatureInput {
	const { cursor: _cursor, ...state } = input.state;
	return { ...input, state } as SearchFeatureInput;
}

export interface CompiledSearchFeature<
	Request extends CompiledSearchRequest = CompiledSearchRequest,
> {
	readonly request: Request;
	readonly plan: ValidatedSearchPlan<Request>;
	readonly enforcedZoneId?: string;
	readonly inputIdentity: string;
	readonly facetBindings: readonly {
		readonly controlKey: string;
		readonly field: SearchField;
		readonly optionPolicy?: ResolvedSearchControl["optionPolicy"];
	}[];
}

/**
 * Keeps result ordering independent from how a response's work is budgeted
 * across category cursors.
 *
 * @internal
 */
export interface SearchExecutionPolicy {
	readonly sortProfile: SearchFeatureSurface;
	readonly pageBudget: "per-category" | "global";
	/** Optional endpoint-specific narrowing; it can never add fields or sorts to the global enums. */
	readonly endpoint?: SearchEndpointPolicy;
}

export interface GroupedSearchExecutionPolicy extends SearchExecutionPolicy {
	readonly pageBudget: "per-category";
}

export interface GlobalSearchExecutionPolicy extends SearchExecutionPolicy {
	readonly pageBudget: "global";
}

export function compileSearchFeatureInput(
	inputValue: unknown,
	execution: GroupedSearchExecutionPolicy,
	hasDevelopmentPreviewAccess?: boolean,
): CompiledSearchFeature<CompiledGroupedSearchRequest>;
export function compileSearchFeatureInput(
	inputValue: unknown,
	execution: GlobalSearchExecutionPolicy,
	hasDevelopmentPreviewAccess?: boolean,
): CompiledSearchFeature<CompiledGlobalSearchRequest>;
export function compileSearchFeatureInput(
	inputValue: unknown,
	execution: SearchExecutionPolicy,
	hasDevelopmentPreviewAccess = true,
): CompiledSearchFeature {
	let input: SearchFeatureInput;
	try {
		input = parseSearchFeatureInput(inputValue);
	} catch (cause) {
		throw new InvalidSearch(cause instanceof Error ? cause.message : "Invalid Search input");
	}
	const resolved = resolveFilterDocument(
		input.filterDocument,
		hasDevelopmentPreviewAccess,
		execution.endpoint,
	);
	const enabledControls = resolved.controls.filter((control) => control.enabled);
	const controls = new Map(enabledControls.map((control) => [control.key, control]));
	const query = unitFilterSearchQuery(input.state.filter);
	if (!resolved.query.enabled && query)
		throw new InvalidSearch("This Filter does not accept a query");
	if (resolved.query.required && !query.trim()) throw new InvalidSearch("Search query is required");
	const sortConfiguration: SearchSortConfiguration = resolved.sort[execution.sortProfile];
	const sort = input.state.sort ?? defaultSearchSort(sortConfiguration, query);
	if (!sortConfiguration.options.includes(sort))
		throw new InvalidSearch(`Search sort ${sort} is unavailable`);
	if (!isSearchSortAvailable(sort, query))
		throw new InvalidSearch(`Search sort ${sort} requires a text query`);
	const requestedPageSize = input.state.pageSize ?? 20;
	if (requestedPageSize > WorkPolicy.search.maxPageSize)
		throw new InvalidSearch("Search page size exceeds the server maximum");
	// Link and Tag injections are composed constraints. Keeping them separate
	// permits repeated Tag injections to mean an intersection. Empty Filter
	// documents contribute no baseline expression.
	const injected = input.injections.map((injection) => injection.value);
	const used = new Set<string>();
	let searchExpression = input.state.expression
		? unwrapExpression(input.state.expression, controls, used)
		: undefined;
	for (const value of injected) {
		validateControlValue(value, controls.get(value.controlKey));
		used.add(value.controlKey);
	}
	if (injected.length)
		searchExpression = combineSearchExpressions("all", [
			...injected.map((value) => normalizeFilterExpression(value.filter)),
			...(searchExpression ? [searchExpression] : []),
		]);
	for (const control of enabledControls)
		if (control.required && !used.has(control.key))
			throw new InvalidSearch(`Required Search control ${control.key} is missing`);

	const context = scopeForContexts(input.contexts);
	if (context.contextExpression)
		searchExpression = combineSearchExpressions("all", [
			context.contextExpression,
			...(searchExpression ? [searchExpression] : []),
		]);
	if (searchExpression) assertSearchExpression(searchExpression, { maxDepth: 6, maxNodes: 100 });
	const categories = searchExpression
		? resolved.categories.filter(
				(category) =>
					specializeSearchExpressionForCategory(category, searchExpression).state !== "match-none",
			)
		: resolved.categories;
	if (!categories.length) throw new InvalidSearch("Search filters exclude every category");
	// Per-category Search gives every result group this budget. A Search Feed
	// applies it once to its single globally ordered candidate stream.
	const pageSize = requestedPageSize;
	const endpointFacetFields = execution.endpoint?.facets
		? new Set(execution.endpoint.facets)
		: undefined;
	const facets = enabledControls
		.filter(
			(control) =>
				(endpointFacetFields
					? endpointFacetFields.has(control.field)
					: control.disclosure === "visible" && GlobalFacetFields.has(control.field)) &&
				fieldDefinition(control.field).facet !== "none",
		)
		.map((control) => ({
			controlKey: control.key,
			field: control.field,
			...(control.optionPolicy ? { optionPolicy: control.optionPolicy } : {}),
		}));
	if (facets.length > WorkPolicy.search.maxFacets)
		throw new InvalidSearch("Filter document exceeds the server facet maximum");
	const domainFilter = combineUnitPredicates([
		input.filterDocument.where,
		input.state.filter?.where,
	]);
	const request: CompiledSearchRequest = {
		pageBudget: execution.pageBudget,
		scope: context.scope,
		categories,
		query,
		constraints: [...context.contextFilters],
		searchExpression,
		...(domainFilter ? { domainFilter } : {}),
		sort,
		pageSize,
		maxResultWindow: WorkPolicy.search.maxResultWindow,
		cursor: input.state.cursor,
		facets: [...new Set(facets.map((facet) => facet.field))],
	};
	return {
		request,
		plan: ValidatedSearchPlan.create(request, {
			contexts: input.contexts.length,
			injections: input.injections.length,
		}),
		...(context.enforcedZoneId ? { enforcedZoneId: context.enforcedZoneId } : {}),
		inputIdentity: `${execution.sortProfile}:${execution.pageBudget}:${JSON.stringify(
			execution.endpoint ?? {},
		)}:${canonicalSearchFeatureInput(withoutCursor(input))}`,
		facetBindings: facets,
	};
}

export function mapSearchFeatureFacets(
	facets: readonly {
		readonly field: SearchField;
		readonly options: readonly {
			readonly value: string;
			readonly count: SearchCountResult;
		}[];
	}[],
	bindings: CompiledSearchFeature["facetBindings"],
) {
	const byField = new Map(facets.map((facet) => [facet.field, facet]));
	return bindings.flatMap((binding) => {
		const facet = byField.get(binding.field);
		if (!facet) return [];
		const options = facet.options.filter((option) => {
			const policy = binding.optionPolicy;
			if (!policy || policy.kind === "all") return true;
			const listed = policy.values.some((value) => sameScalar(value, option.value));
			return policy.kind === "include" ? listed : !listed;
		});
		return [{ controlKey: binding.controlKey, field: binding.field, options }];
	});
}

export async function executeSearchFeatureInput(
	input: unknown,
	execution: GroupedSearchExecutionPolicy,
	localizationLanguages: readonly ContentLanguage[],
	profileId: string | undefined,
	hasDevelopmentPreviewAccess: boolean,
) {
	const compiled = compileSearchFeatureInput(input, execution, hasDevelopmentPreviewAccess);
	const { executeCompiledSearch } = await import("./execution");
	const result = await executeCompiledSearch(
		compiled.plan,
		localizationLanguages,
		profileId,
		compiled.enforcedZoneId,
		compiled.inputIdentity,
	);
	return {
		...result,
		facets: mapSearchFeatureFacets(result.facets, compiled.facetBindings),
	};
}

/** @internal Executes a Search Feature for a Feed presenter that only consumes Unit identities. */
export async function executeSearchFeatureFeedInput(
	input: unknown,
	execution: GlobalSearchExecutionPolicy,
	localizationLanguages: readonly ContentLanguage[],
	profileId: string | undefined,
	hasDevelopmentPreviewAccess: boolean,
) {
	const compiled = compileSearchFeatureInput(input, execution, hasDevelopmentPreviewAccess);
	const { executeCompiledSearchIdentifiers } = await import("./execution");
	const result = await executeCompiledSearchIdentifiers(
		compiled.plan,
		localizationLanguages,
		profileId,
		compiled.enforcedZoneId,
		compiled.inputIdentity,
	);
	return {
		...result,
		facets: mapSearchFeatureFacets(result.facets, compiled.facetBindings),
	};
}
