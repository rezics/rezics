import {
	canonicalSearchFeatureInput,
	combineUnitPredicates,
	defaultSearchSort,
	isSearchSortAvailable,
	parseSearchFeatureInput,
	parseSearchDocument,
	type ResolvedSearchControl,
	type SearchControlExpression,
	type SearchControlValue,
	type SearchDocument,
	type SearchDocumentControl,
	type SearchFeatureContext,
	type SearchFeatureInput,
	type SearchFeatureSurface,
	type SearchField,
	type SearchControlPredicate,
	type SearchScalar,
	type SearchSort,
	type SearchTemplateId,
	searchSortConfiguration,
	unitFilterSearchQuery,
} from "@rezics/filter";
import type { ContentLanguage } from "@rezics/i18n";

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
	type CompiledSearchRequest,
	type SearchExpression,
} from "./query";
import { SearchCategories } from "./schema";

interface SearchTemplateDefinition {
	readonly id: SearchTemplateId;
	readonly categories: readonly (typeof SearchCategories)[number][];
	readonly fields: readonly SearchField[];
	readonly constraints: readonly SearchControlPredicate[];
	readonly visible: ReadonlySet<SearchField>;
	readonly defaultFacets: readonly SearchField[];
	readonly sorts: readonly SearchSort[];
	readonly maxPageSize: number;
	readonly maxResultWindow: number;
}

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

const CommonFields = [
	"language",
	"content-rating",
	"ai-disclosure",
	"license",
	"tag",
	"credit",
	"realm",
	"realm-tag-vote",
	"created-at",
	"updated-at",
	"published-at",
] as const satisfies readonly SearchField[];

const ContentLicenseFields = ["content-license"] as const satisfies readonly SearchField[];
const WorkZoneCategories = ["units", "posts", "reviews", "collections"] as const;

const TemplateDefinitions = {
	global: {
		id: "global",
		categories: SearchCategories,
		fields: [
			"category",
			"kind",
			...CommonFields,
			"realm-tag-context",
			"subject",
			"target",
			"root",
			"parent",
			"owner",
			"publisher-profile",
		],
		constraints: [],
		visible: new Set<SearchField>(["category", "kind", "language", "content-rating", "tag"]),
		defaultFacets: ["category", "kind", "language", "content-rating", "tag"],
		sorts: CommonSorts,
		maxPageSize: 50,
		maxResultWindow: 10_000,
	},
	book: {
		id: "book",
		categories: WorkZoneCategories,
		fields: [
			...CommonFields,
			...ContentLicenseFields,
			"book-isbn13",
			"book-publication-date",
			"book-page-count",
			"book-word-count",
			"book-format",
		],
		constraints: [],
		visible: new Set<SearchField>(["language", "tag", "book-word-count", "book-format"]),
		defaultFacets: ["language", "tag", "book-format"],
		sorts: CommonSorts,
		maxPageSize: 50,
		maxResultWindow: 10_000,
	},
	media: {
		id: "media",
		categories: WorkZoneCategories,
		fields: [
			...CommonFields,
			...ContentLicenseFields,
			"media-kind",
			"media-release-date",
			"media-runtime-minutes",
			"media-episode-count",
			"media-season-count",
		],
		constraints: [],
		visible: new Set<SearchField>([
			"language",
			"tag",
			"media-kind",
			"media-release-date",
			"media-runtime-minutes",
		]),
		defaultFacets: ["language", "tag", "media-kind"],
		sorts: CommonSorts,
		maxPageSize: 50,
		maxResultWindow: 10_000,
	},
	software: {
		id: "software",
		categories: WorkZoneCategories,
		fields: [
			...CommonFields,
			...ContentLicenseFields,
			"software-release-date",
			"software-version-label",
			"software-platform",
			"software-requirement-tier",
		],
		constraints: [],
		visible: new Set<SearchField>([
			"language",
			"tag",
			"software-platform",
			"software-requirement-tier",
		]),
		defaultFacets: ["language", "tag", "software-platform", "software-requirement-tier"],
		sorts: CommonSorts,
		maxPageSize: 50,
		maxResultWindow: 10_000,
	},
	progress: {
		id: "progress",
		categories: ["units"],
		fields: [],
		constraints: [{ field: "kind", operator: "any-of", values: ["book", "media", "software"] }],
		visible: new Set<SearchField>(),
		defaultFacets: [],
		sorts: ProgressSearchSorts,
		maxPageSize: 50,
		maxResultWindow: 10_000,
	},
	realm: {
		id: "realm",
		categories: ["realms"],
		fields: [...CommonFields],
		constraints: [],
		visible: new Set<SearchField>(["language", "tag"]),
		defaultFacets: ["language", "tag"],
		sorts: CommonSorts,
		maxPageSize: 50,
		maxResultWindow: 10_000,
	},
	zone: {
		id: "zone",
		categories: ["units"],
		fields: [...CommonFields],
		constraints: [{ field: "kind", operator: "equals", value: "zone" }],
		visible: new Set<SearchField>(["language", "tag"]),
		defaultFacets: ["language", "tag"],
		sorts: CommonSorts,
		maxPageSize: 50,
		maxResultWindow: 10_000,
	},
} as const satisfies Record<SearchTemplateId, SearchTemplateDefinition>;

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

function templateFor(document: SearchDocument): SearchTemplateDefinition {
	if (document.template.version !== 1)
		throw new InvalidSearch("Unsupported Search template version");
	return TemplateDefinitions[document.template.id];
}

function validateTemplateDocument(document: SearchDocument): SearchTemplateDefinition {
	const template = templateFor(document);
	if (!document.categories.every((category) => template.categories.includes(category)))
		throw new InvalidSearch("Search document category is outside its template");
	const allowedFields = new Set<SearchField>(template.fields);
	const fieldCounts = new Map<SearchField, number>();
	for (const control of document.controls) {
		if (!allowedFields.has(control.field))
			throw new InvalidSearch(`Search control ${control.key} is outside its template`);
		fieldCounts.set(control.field, (fieldCounts.get(control.field) ?? 0) + 1);
		if (control.field !== "tag" && (fieldCounts.get(control.field) ?? 0) > 1)
			throw new InvalidSearch(`Search field ${control.field} cannot be repeated`);
		const definition = fieldDefinition(control.field);
		if (!definition.categories.some((category) => document.categories.includes(category)))
			throw new InvalidSearch(
				`Search control ${control.key} does not apply to its categories`,
			);
		if (control.optionPolicy && control.optionPolicy.kind !== "all")
			for (const value of control.optionPolicy.values) validateScalar(control.field, value);
	}
	for (const configuration of [document.sort.search, document.sort.feed]) {
		if (!configuration.options.every((sort) => template.sorts.includes(sort)))
			throw new InvalidSearch("Search document sort is outside its template");
		for (const sort of configuration.options)
			if (
				template.id !== "progress" &&
				document.categories.some((category) => !supportsCurrentSearchSort(category, sort))
			)
				throw new InvalidSearch(
					`Search sort ${sort} does not apply to every document category`,
				);
	}
	if (document.results.maxPageSize > template.maxPageSize)
		throw new InvalidSearch("Search document page size exceeds its template");
	if (document.results.maxResultWindow > template.maxResultWindow)
		throw new InvalidSearch("Search document result window exceeds its template");
	return template;
}

function defaultControl(
	field: SearchField,
	template: SearchTemplateDefinition,
): SearchDocumentControl {
	return {
		key: field,
		field,
		enabled: true,
		disclosure: template.visible.has(field) ? "visible" : "hidden",
	};
}

export function createDefaultSearchDocument(templateId: SearchTemplateId): SearchDocument {
	const template = TemplateDefinitions[templateId];
	const controls = template.fields.map((field) => defaultControl(field, template));
	const visibleControls = controls
		.filter((control) => control.disclosure === "visible")
		.map((control) => control.key);
	const hiddenControls = controls
		.filter((control) => control.disclosure === "hidden")
		.map((control) => control.key);
	return parseSearchDocument({
		version: 1,
		template: { id: template.id, version: 1 },
		categories: [...template.categories],
		query: { enabled: true },
		defaults: [],
		controls,
		sections: [
			...(visibleControls.length
				? [
						{
							key: "filters" as const,
							disclosure: "visible" as const,
							controls: visibleControls,
						},
					]
				: []),
			...(hiddenControls.length
				? [
						{
							key: "more-filters" as const,
							disclosure: "hidden" as const,
							controls: hiddenControls,
						},
					]
				: []),
		],
		sort: {
			search: {
				defaults:
					templateId === "progress"
						? {
								emptyQuery: "progressLastSeenAt:desc",
								textQuery: "progressLastSeenAt:desc",
							}
						: { emptyQuery: "best", textQuery: "relevance" },
				options: [...template.sorts],
			},
			feed: {
				defaults:
					templateId === "progress"
						? {
								emptyQuery: "progressLastSeenAt:desc",
								textQuery: "progressLastSeenAt:desc",
							}
						: { emptyQuery: "best", textQuery: "best" },
				options: template.sorts.filter((sort) => sort !== "relevance"),
			},
		},
		results: {
			pageSize: 20,
			maxPageSize: template.maxPageSize,
			maxResultWindow: template.maxResultWindow,
			facets: template.defaultFacets.filter((field) =>
				controls.some((control) => control.key === field),
			),
		},
	});
}

export function resolveSearchDocument(
	documentValue: unknown,
	hasDevelopmentPreviewAccess: boolean,
) {
	const parsed = parseSearchDocument(documentValue);
	const document = hasDevelopmentPreviewAccess
		? parsed
		: {
				...parsed,
				categories: parsed.categories.filter((category) => category !== "tag-structures"),
			};
	validateTemplateDocument(document);
	const sectionByControl = new Map(
		document.sections.flatMap((section) =>
			section.controls.map((controlKey) => [controlKey, section.key] as const),
		),
	);
	const controls = document.controls
		.filter((control) => control.enabled)
		.map((control): ResolvedSearchControl => {
			const definition = fieldDefinition(control.field);
			return {
				key: control.key,
				field: control.field,
				component: componentFor(definition),
				operators: [...definition.operators],
				...(optionSourceFor(control.field, definition, document.categories)
					? {
							optionSource: optionSourceFor(
								control.field,
								definition,
								document.categories,
							),
						}
					: {}),
				...(control.optionPolicy ? { optionPolicy: control.optionPolicy } : {}),
				...(control.labelUnitId ? { labelUnitId: control.labelUnitId } : {}),
				...(control.required === undefined ? {} : { required: control.required }),
				disclosure: control.disclosure,
				...(sectionByControl.has(control.key)
					? { sectionKey: sectionByControl.get(control.key) }
					: {}),
			};
		});
	const controlByKey = new Map(controls.map((control) => [control.key, control]));
	for (const value of document.defaults)
		validateControlValue(value, controlByKey.get(value.controlKey));
	return { document, controls } as const;
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
	if (
		filter.operator !== "all-of" &&
		filter.operator !== "any-of" &&
		filter.operator !== "none-of"
	)
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
			!("field" in clause) && clause.operator === expression.operator
				? clause.clauses
				: [clause],
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
									operator: "any",
									clauses: [
										{
											field: "category",
											operator: "any-of",
											values: ["posts", "reviews", "entities", "collections"],
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
													operator: "any-of",
													values: ["book", "media", "software"],
												},
											],
										},
									],
								},
								{
									field: "publisher-profile",
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

export interface CompiledSearchFeature {
	readonly request: CompiledSearchRequest;
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
	readonly pageBudget: "per-category" | "shared";
}

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
	if (!hasDevelopmentPreviewAccess)
		input = {
			...input,
			document: {
				...input.document,
				categories: input.document.categories.filter(
					(category) => category !== "tag-structures",
				),
			},
		};
	if (input.document.categories.length === 0)
		throw new InvalidSearch("Search document has no available categories");
	const template = validateTemplateDocument(input.document);
	const resolved = resolveSearchDocument(input.document, true);
	const controls = new Map(resolved.controls.map((control) => [control.key, control]));
	const query = unitFilterSearchQuery(input.state.filter);
	if (!input.document.query.enabled && query)
		throw new InvalidSearch("This Search document does not accept a query");
	if (input.document.query.required && !query.trim())
		throw new InvalidSearch("Search query is required");
	const sortConfiguration = searchSortConfiguration(input.document, execution.sortProfile);
	const sort = input.state.sort ?? defaultSearchSort(sortConfiguration, query);
	if (!sortConfiguration.options.includes(sort))
		throw new InvalidSearch(`Search sort ${sort} is unavailable`);
	if (!isSearchSortAvailable(sort, query))
		throw new InvalidSearch(`Search sort ${sort} requires a text query`);
	const requestedPageSize = input.state.pageSize ?? input.document.results.pageSize;
	if (requestedPageSize > input.document.results.maxPageSize)
		throw new InvalidSearch("Search page size exceeds the configured maximum");
	const baseline = new Map<string, SearchControlValue>();
	for (const value of input.document.defaults) baseline.set(value.controlKey, value);
	// Link and Tag injections are composed constraints, not editable defaults.
	// Keeping them separate prevents state from replacing them and permits
	// repeated Tag injections to mean an intersection. Server-established
	// contexts, including Realm scope, are composed separately below.
	const injected = input.injections.map((injection) => injection.value);
	const used = new Set<string>();
	let searchExpression = input.state.expression
		? unwrapExpression(input.state.expression, controls, used)
		: undefined;
	const defaults = [
		...injected,
		...[...baseline.values()].filter((value) => !used.has(value.controlKey)),
	];
	for (const value of defaults) {
		validateControlValue(value, controls.get(value.controlKey));
		used.add(value.controlKey);
	}
	if (defaults.length)
		searchExpression = combineSearchExpressions("all", [
			...defaults.map((value) => normalizeFilterExpression(value.filter)),
			...(searchExpression ? [searchExpression] : []),
		]);
	for (const control of resolved.controls)
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
		? input.document.categories.filter(
				(category) =>
					specializeSearchExpressionForCategory(category, searchExpression).state !==
					"match-none",
			)
		: input.document.categories;
	if (!categories.length) throw new InvalidSearch("Search filters exclude every category");
	// Search executes one authorized cursor per effective category. A category
	// filter must narrow this divisor, otherwise an Entities-only page of 20
	// becomes 2 merely because the document originally declared ten categories.
	const pageSize =
		execution.pageBudget === "shared"
			? Math.max(1, Math.floor(requestedPageSize / categories.length))
			: requestedPageSize;
	const facets = input.document.results.facets.map((controlKey) => {
		const control = controls.get(controlKey);
		if (!control) throw new InvalidSearch(`Facet control ${controlKey} is unavailable`);
		if (fieldDefinition(control.field).facet === "none")
			throw new InvalidSearch(`Search control ${controlKey} cannot provide facets`);
		return {
			controlKey,
			field: control.field,
			...(control.optionPolicy ? { optionPolicy: control.optionPolicy } : {}),
		};
	});
	const domainFilter = combineUnitPredicates([input.document.filter, input.state.filter?.where]);
	return {
		request: {
			scope: context.scope,
			categories,
			query,
			constraints: [...template.constraints, ...context.contextFilters],
			searchExpression,
			...(domainFilter ? { domainFilter } : {}),
			sort,
			pageSize,
			maxResultWindow: input.document.results.maxResultWindow,
			cursor: input.state.cursor,
			facets: [...new Set(facets.map((facet) => facet.field))],
		},
		...(context.enforcedZoneId ? { enforcedZoneId: context.enforcedZoneId } : {}),
		inputIdentity: `${execution.sortProfile}:${execution.pageBudget}:${canonicalSearchFeatureInput(
			withoutCursor(input),
		)}`,
		facetBindings: facets,
	};
}

export function mapSearchFeatureFacets(
	facets: readonly {
		readonly field: SearchField;
		readonly options: readonly {
			readonly value: string;
			readonly count: { readonly value: number; readonly relation: "exact" | "lower-bound" };
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
	execution: SearchExecutionPolicy,
	localizationLanguages: readonly ContentLanguage[],
	profileId: string | undefined,
	hasDevelopmentPreviewAccess: boolean,
) {
	const compiled = compileSearchFeatureInput(input, execution, hasDevelopmentPreviewAccess);
	const { executeCompiledSearch } = await import("./execution");
	const result = await executeCompiledSearch(
		compiled.request,
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
