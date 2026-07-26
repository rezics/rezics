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
	type SearchMode,
	type SearchScalar,
	type SearchSort,
	type SearchTemplateId,
	searchSortConfiguration,
	unitFilterSearchQuery,
} from "@rezics/filter";

import { InvalidSearch } from "./errors";
import { CurrentSearchFieldRegistry, type SearchFieldDefinition } from "./field-registry";
import {
	assertSearchExpression,
	combineSearchExpressions,
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

const CatalogFields = ["catalog-licensed"] as const satisfies readonly SearchField[];
const CatalogZoneCategories = ["units", "posts", "reviews", "collections"] as const;

const TemplateDefinitions = {
	global: {
		id: "global",
		categories: SearchCategories,
		fields: [
			"category",
			"kind",
			...CommonFields,
			"subject",
			"target",
			"root",
			"parent",
			"owner",
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
		categories: CatalogZoneCategories,
		fields: [
			...CommonFields,
			...CatalogFields,
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
		categories: CatalogZoneCategories,
		fields: [
			...CommonFields,
			...CatalogFields,
			"catalog-release-date",
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
		categories: CatalogZoneCategories,
		fields: [
			...CommonFields,
			...CatalogFields,
			"catalog-release-date",
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
	const definition = CurrentSearchFieldRegistry[field];
	if (!definition) throw new InvalidSearch(`Search field ${field} is not implemented`);
	return definition;
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
): ResolvedSearchControl["optionSource"] {
	const options = StaticOptions[field];
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
		if (!control.modes.every((mode) => definition.modes.includes(mode)))
			throw new InvalidSearch(`Search control ${control.key} uses an unsupported mode`);
		if (control.optionPolicy && control.optionPolicy.kind !== "all")
			for (const value of control.optionPolicy.values) validateScalar(control.field, value);
	}
	for (const configuration of [document.sort.search, document.sort.feed])
		if (!configuration.options.every((sort) => template.sorts.includes(sort)))
			throw new InvalidSearch("Search document sort is outside its template");
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
	const definition = fieldDefinition(field);
	return {
		key: field,
		field,
		enabled: true,
		disclosure: template.visible.has(field) ? "visible" : "hidden",
		modes: [...definition.modes],
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
		modes: { available: ["basic", "advanced"], default: "basic" },
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
				defaults: { emptyQuery: "best", textQuery: "relevance" },
				options: [...template.sorts],
			},
			feed: {
				defaults: { emptyQuery: "best", textQuery: "best" },
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

export function resolveSearchDocument(documentValue: unknown) {
	const document = parseSearchDocument(documentValue);
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
				modes: [...control.modes],
				operators: [...definition.operators],
				...(optionSourceFor(control.field, definition)
					? { optionSource: optionSourceFor(control.field, definition) }
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
		validateControlValue(value, controlByKey.get(value.controlKey), document.modes.default);
	return { document, controls } as const;
}

function filterValues(filter: SearchControlPredicate): readonly SearchScalar[] {
	if (filter.field === "realm-tag-vote") return [];
	if ("values" in filter) return filter.values;
	if ("value" in filter) return [filter.value];
	return [filter.lower, filter.upper].filter(
		(value): value is SearchScalar => value !== undefined,
	);
}

function sameScalar(left: SearchScalar, right: SearchScalar): boolean {
	return typeof left === typeof right && left === right;
}

const UuidPattern =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const DatePattern = /^\d{4}-\d{2}-\d{2}$/;

function validateScalar(field: SearchField, value: SearchScalar): void {
	const scalar = fieldDefinition(field).scalar;
	if (scalar === "realm-tag-vote")
		throw new InvalidSearch(`Search field ${field} does not accept scalar values`);
	const valid =
		scalar === "boolean"
			? typeof value === "boolean"
			: scalar === "integer"
				? typeof value === "number" && Number.isSafeInteger(value)
				: scalar === "uuid"
					? typeof value === "string" && UuidPattern.test(value)
					: scalar === "date"
						? typeof value === "string" && DatePattern.test(value)
						: typeof value === "string";
	if (!valid) throw new InvalidSearch(`Search field ${field} has an invalid ${scalar} value`);
}

function validateFilterValue(filter: SearchControlPredicate): void {
	if (filter.field === "realm-tag-vote") {
		if (filter.operator !== "matches")
			throw new InvalidSearch("Realm Tag vote requires the matches operator");
		for (const [name, range] of [
			["score", filter.score],
			["voteCount", filter.voteCount],
		] as const)
			if (range) {
				if (
					(range.lower !== undefined && !Number.isSafeInteger(range.lower)) ||
					(range.upper !== undefined && !Number.isSafeInteger(range.upper))
				)
					throw new InvalidSearch(`Realm Tag vote ${name} requires safe integer bounds`);
				if (
					range.lower !== undefined &&
					range.upper !== undefined &&
					range.lower > range.upper
				)
					throw new InvalidSearch(
						`Realm Tag vote ${name} lower bound exceeds its upper bound`,
					);
			}
		return;
	}
	for (const value of filterValues(filter)) validateScalar(filter.field, value);
}

function validateControlValue(
	value: SearchControlValue,
	control: ResolvedSearchControl | undefined,
	mode: SearchMode,
): void {
	if (!control) throw new InvalidSearch(`Search control ${value.controlKey} is unavailable`);
	if (control.field !== value.filter.field)
		throw new InvalidSearch(`Search control ${control.key} field does not match its value`);
	if (!control.modes.includes(mode))
		throw new InvalidSearch(`Search control ${control.key} is unavailable in ${mode} mode`);
	if (!control.operators.includes(value.filter.operator))
		throw new InvalidSearch(`Search control ${control.key} does not allow this operator`);
	validateFilterValue(value.filter);
	const options = control.optionSource?.kind === "static" ? control.optionSource.options : null;
	if (
		options &&
		!filterValues(value.filter).every((item) =>
			options.some((option) => sameScalar(option.value, item)),
		)
	)
		throw new InvalidSearch(`Search control ${control.key} uses an unknown option`);
	const policy = control.optionPolicy;
	if (
		policy &&
		policy.kind !== "all" &&
		!filterValues(value.filter).every((item) => {
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
	mode: SearchMode,
	used: Set<string>,
): SearchExpression {
	if ("controlKey" in expression) {
		validateControlValue(expression, controls.get(expression.controlKey), mode);
		used.add(expression.controlKey);
		return normalizeFilterExpression(expression.filter);
	}
	if (expression.operator === "not")
		return {
			operator: "not",
			clause: unwrapExpression(expression.clause, controls, mode, used),
		};
	const clauses = expression.clauses
		.map((clause) => unwrapExpression(clause, controls, mode, used))
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
									field: "category",
									operator: "any-of",
									values: ["posts", "reviews"],
								},
								{
									field: "credit",
									operator: "equals",
									value: profile.profileId,
								},
							],
						},
						{
							operator: "all",
							clauses: [
								{
									field: "category",
									operator: "any-of",
									values: ["entity", "collections"],
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

export function compileSearchFeatureInput(
	inputValue: unknown,
	surface: SearchFeatureSurface,
): CompiledSearchFeature {
	let input: SearchFeatureInput;
	try {
		input = parseSearchFeatureInput(inputValue);
	} catch (cause) {
		throw new InvalidSearch(cause instanceof Error ? cause.message : "Invalid Search input");
	}
	const template = validateTemplateDocument(input.document);
	const resolved = resolveSearchDocument(input.document);
	const controls = new Map(resolved.controls.map((control) => [control.key, control]));
	const mode = input.state.mode;
	if (!input.document.modes.available.includes(mode))
		throw new InvalidSearch(`Search mode ${mode} is unavailable`);
	const query = unitFilterSearchQuery(input.state.filter);
	if (!input.document.query.enabled && query)
		throw new InvalidSearch("This Search document does not accept a query");
	if (input.document.query.required && !query.trim())
		throw new InvalidSearch("Search query is required");
	const sortConfiguration = searchSortConfiguration(input.document, surface);
	const sort = input.state.sort ?? defaultSearchSort(sortConfiguration, query);
	if (!sortConfiguration.options.includes(sort))
		throw new InvalidSearch(`Search sort ${sort} is unavailable`);
	if (!isSearchSortAvailable(sort, query))
		throw new InvalidSearch(`Search sort ${sort} requires a text query`);
	const pageSize = input.state.pageSize ?? input.document.results.pageSize;
	if (pageSize > input.document.results.maxPageSize)
		throw new InvalidSearch("Search page size exceeds the configured maximum");

	const baseline = new Map<string, SearchControlValue>();
	for (const value of input.document.defaults) baseline.set(value.controlKey, value);
	// Injections are composed constraints, not editable defaults. Keeping them
	// separate prevents state from replacing link/tag/Realm context and permits
	// repeated tag injections to mean an intersection.
	const injected = input.injections.map((injection) => injection.value);
	const used = new Set<string>();
	let searchExpression: SearchExpression | undefined;
	if (mode === "basic") {
		for (const value of input.state.values) baseline.set(value.controlKey, value);
		const values = [...injected, ...baseline.values()];
		for (const value of values) {
			validateControlValue(value, controls.get(value.controlKey), mode);
			used.add(value.controlKey);
		}
		searchExpression = combineSearchExpressions(
			"all",
			values.map((value) => normalizeFilterExpression(value.filter)),
		);
	} else {
		searchExpression = input.state.expression
			? unwrapExpression(input.state.expression, controls, mode, used)
			: undefined;
		const defaults = [
			...injected,
			...[...baseline.values()].filter((value) => !used.has(value.controlKey)),
		];
		for (const value of defaults) {
			validateControlValue(value, controls.get(value.controlKey), mode);
			used.add(value.controlKey);
		}
		if (defaults.length)
			searchExpression = combineSearchExpressions("all", [
				...defaults.map((value) => normalizeFilterExpression(value.filter)),
				...(searchExpression ? [searchExpression] : []),
			]);
	}
	for (const control of resolved.controls)
		if (control.required && control.modes.includes(mode) && !used.has(control.key))
			throw new InvalidSearch(`Required Search control ${control.key} is missing`);

	const context = scopeForContexts(input.contexts);
	if (context.contextExpression)
		searchExpression = combineSearchExpressions("all", [
			context.contextExpression,
			...(searchExpression ? [searchExpression] : []),
		]);
	if (searchExpression) assertSearchExpression(searchExpression, { maxDepth: 6, maxNodes: 100 });
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
			categories: input.document.categories,
			mode,
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
		inputIdentity: `${surface}:${canonicalSearchFeatureInput(withoutCursor(input))}`,
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
	surface: SearchFeatureSurface,
	profileId?: string,
) {
	const compiled = compileSearchFeatureInput(input, surface);
	const { executeCompiledSearch } = await import("./execution");
	const result = await executeCompiledSearch(
		compiled.request,
		profileId,
		compiled.enforcedZoneId,
		compiled.inputIdentity,
	);
	return {
		...result,
		facets: mapSearchFeatureFacets(result.facets, compiled.facetBindings),
	};
}
