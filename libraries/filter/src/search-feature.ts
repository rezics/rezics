import { type Static, Type } from "@sinclair/typebox";
import { Check, Value } from "@sinclair/typebox/value";
import { UnitFilter, assertUnitFilter } from "./filter";
import {
	UnitPredicate as UnitPredicateSchema,
	assertUnitPredicate,
	type UnitPredicate,
} from "./unit";

import {
	SearchCategory,
	SearchCategoryValues,
	SearchControl,
	SearchControlPredicate,
	SearchField,
	SearchFieldValues,
	SearchOptionPolicy,
	SearchSort,
	SearchSortValues,
} from "./search-primitives";

export const SearchFeatureSurfaceValues = ["search", "feed"] as const;
export type SearchFeatureSurface = (typeof SearchFeatureSurfaceValues)[number];
export const SearchFeatureSurface = Type.Union([Type.Literal("search"), Type.Literal("feed")]);

const Uuid = Type.String({
	pattern:
		"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
});

const SearchControlKey = Type.String({
	minLength: 1,
	maxLength: 64,
	pattern: "^[a-z][a-z0-9-]*$",
});

export const SearchDisclosureValues = ["visible", "hidden"] as const;
export type SearchDisclosure = (typeof SearchDisclosureValues)[number];
export const SearchDisclosure = Type.Union([Type.Literal("visible"), Type.Literal("hidden")]);

/** A user-controlled predicate is identified by control, not merely by indexed field. */
export const SearchControlValue = Type.Object(
	{
		controlKey: SearchControlKey,
		filter: SearchControlPredicate,
	},
	{ additionalProperties: false, $id: "SearchControlValue" },
);
export type SearchControlValue = Static<typeof SearchControlValue>;

export const SearchControlExpression = Type.Recursive(
	(This) =>
		Type.Union([
			SearchControlValue,
			Type.Object(
				{
					operator: Type.Union([Type.Literal("all"), Type.Literal("any")]),
					clauses: Type.Array(This, { minItems: 1, maxItems: 20 }),
				},
				{ additionalProperties: false },
			),
			Type.Object({ operator: Type.Literal("not"), clause: This }, { additionalProperties: false }),
		]),
	{ $id: "SearchControlExpression" },
);
export type SearchControlExpression = Static<typeof SearchControlExpression>;

/** Returns the positive languages referenced by one Search predicate. */
export function readSearchPredicateLanguageBoundary(
	filter: SearchControlPredicate,
): readonly string[] | undefined {
	if (filter.field !== "language") return undefined;
	if (filter.operator === "equals")
		return typeof filter.value === "string" ? [filter.value] : undefined;
	if (filter.operator === "any-of" || filter.operator === "all-of")
		return filter.values.filter((value): value is string => typeof value === "string");
	return undefined;
}

/**
 * Returns the positive language set that every matching branch must satisfy.
 * Negative predicates and unconstrained `any` branches cannot form a safe
 * presentation boundary and therefore return `undefined`.
 */
export function readSearchLanguageBoundary(
	expression: SearchControlExpression | undefined,
): readonly string[] | undefined {
	if (!expression) return undefined;
	if ("controlKey" in expression) {
		return readSearchPredicateLanguageBoundary(expression.filter);
	}
	if (expression.operator === "not") return undefined;
	const boundaries = expression.clauses.map(readSearchLanguageBoundary);
	if (expression.operator === "any") {
		if (boundaries.some((boundary) => boundary === undefined)) return undefined;
		return [...new Set(boundaries.flatMap((boundary) => boundary ?? []))];
	}
	const constrained = boundaries.filter(
		(boundary): boundary is readonly string[] => boundary !== undefined,
	);
	return constrained.length ? [...new Set(constrained.flatMap((boundary) => boundary))] : undefined;
}

/** A sparse override of one server-owned Search control. */
export const FilterDocumentControl = Type.Object(
	{
		key: SearchControlKey,
		/** Required only for a repeated custom Tag control; built-in keys identify their field. */
		field: Type.Optional(SearchField),
		enabled: Type.Optional(Type.Boolean()),
		disclosure: Type.Optional(SearchDisclosure),
		labelUnitId: Type.Optional(Uuid),
		optionPolicy: Type.Optional(SearchOptionPolicy),
		required: Type.Optional(Type.Boolean()),
	},
	{ additionalProperties: false, $id: "FilterDocumentControl" },
);
export type FilterDocumentControl = Static<typeof FilterDocumentControl>;

export const SearchSortConfiguration = Type.Object(
	{
		defaults: Type.Object(
			{
				emptyQuery: SearchSort,
				textQuery: SearchSort,
			},
			{ additionalProperties: false },
		),
		options: Type.Array(SearchSort, { minItems: 1, maxItems: SearchSortValues.length }),
	},
	{ additionalProperties: false, $id: "SearchSortConfiguration" },
);
export type SearchSortConfiguration = Static<typeof SearchSortConfiguration>;

/**
 * A sparse, engine-independent Filter document.
 *
 * Every member narrows or customizes the single server-owned capability
 * policy. An empty object has no document-level conditions and introduces no
 * defaults. Request limits, result windows, sort fallbacks, indexed fields,
 * and operators remain server-owned and are deliberately absent here.
 */
export const FilterDocument = Type.Object(
	{
		categories: Type.Optional(
			Type.Array(SearchCategory, {
				minItems: 1,
				maxItems: SearchCategoryValues.length,
			}),
		),
		where: Type.Optional(Type.Unsafe<UnitPredicate>(UnitPredicateSchema)),
		controls: Type.Optional(Type.Array(FilterDocumentControl, { maxItems: 50 })),
	},
	{ additionalProperties: false, $id: "FilterDocument" },
);
export type FilterDocument = Static<typeof FilterDocument>;

export const SearchFeatureContext = Type.Union(
	[
		Type.Object({ kind: Type.Literal("realm"), realmId: Uuid }, { additionalProperties: false }),
		Type.Object(
			{ kind: Type.Literal("profile"), profileId: Uuid },
			{ additionalProperties: false },
		),
		Type.Object({ kind: Type.Literal("zone"), zoneId: Uuid }, { additionalProperties: false }),
		Type.Object(
			{
				kind: Type.Literal("unit"),
				unitId: Uuid,
				includeDescendants: Type.Boolean({ default: false }),
			},
			{ additionalProperties: false },
		),
	],
	{ $id: "SearchFeatureContext" },
);
export type SearchFeatureContext = Static<typeof SearchFeatureContext>;

export const SearchInjection = Type.Object(
	{
		source: Type.Union([Type.Literal("tag"), Type.Literal("link")]),
		value: SearchControlValue,
		removable: Type.Boolean({ default: true }),
	},
	{ additionalProperties: false, $id: "SearchInjection" },
);
export type SearchInjection = Static<typeof SearchInjection>;

const SearchExecutionBase = {
	filter: Type.Optional(Type.Ref(UnitFilter)),
	sort: Type.Optional(SearchSort),
	pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
};

/**
 * Opaque continuation token issued by a Search endpoint.
 *
 * Clients may retain and return this value only to the endpoint and request
 * state that produced it. Its encoding and pagination strategy are
 * intentionally server-owned.
 */
export const SearchContinuationToken = Type.String({
	minLength: 1,
	maxLength: 4096,
	description:
		"Opaque continuation token returned by the preceding Search page. Clients must not inspect or modify it.",
});
export type SearchContinuationToken = Static<typeof SearchContinuationToken>;

export const SearchFeatureState = Type.Object(
	{
		...SearchExecutionBase,
		cursor: Type.Optional(SearchContinuationToken),
		expression: Type.Optional(SearchControlExpression),
	},
	{ additionalProperties: false, $id: "SearchFeatureState" },
);
export type SearchFeatureState = Static<typeof SearchFeatureState>;

/** An immutable, cursor-free Search Feature state suitable for a public share link. */
export const SharedSearchQueryState = Type.Object(
	{
		...SearchExecutionBase,
		expression: Type.Optional(SearchControlExpression),
	},
	{ additionalProperties: false, $id: "SharedSearchQueryState" },
);
export type SharedSearchQueryState = Static<typeof SharedSearchQueryState>;

/**
 * Presentation metadata is an untrusted display hint for opaque entity values.
 * Search execution is still authorized and validated exclusively from `state`.
 */
export const SharedSearchQuerySelection = Type.Object(
	{
		field: SearchField,
		value: Type.String({ minLength: 1, maxLength: 500 }),
		title: Type.String({ minLength: 1, maxLength: 500 }),
		kind: Type.String({ minLength: 1, maxLength: 100 }),
	},
	{ additionalProperties: false, $id: "SharedSearchQuerySelection" },
);
export type SharedSearchQuerySelection = Static<typeof SharedSearchQuerySelection>;

export const SharedSearchQueryDocument = Type.Object(
	{
		filterDocument: FilterDocument,
		state: SharedSearchQueryState,
		selections: Type.Array(SharedSearchQuerySelection, { maxItems: 100 }),
	},
	{ additionalProperties: false, $id: "SharedSearchQueryDocument" },
);
export type SharedSearchQueryDocument = Static<typeof SharedSearchQueryDocument>;

/** The complete deterministic input boundary consumed by Search Feature. */
export const SearchFeatureInput = Type.Object(
	{
		filterDocument: FilterDocument,
		contexts: Type.Array(SearchFeatureContext, { maxItems: 4 }),
		injections: Type.Array(SearchInjection, { maxItems: 50 }),
		state: SearchFeatureState,
	},
	{ additionalProperties: false, $id: "SearchFeatureInput" },
);
export type SearchFeatureInput = Static<typeof SearchFeatureInput>;

/** Server-resolved control metadata that is safe for a renderer to consume. */
export const ResolvedSearchControl = Type.Composite(
	[
		SearchControl,
		Type.Object({
			enabled: Type.Boolean(),
			disclosure: SearchDisclosure,
		}),
	],
	{ additionalProperties: false, $id: "ResolvedSearchControl" },
);
export type ResolvedSearchControl = Static<typeof ResolvedSearchControl>;

export const SearchFeatureDefinition = Type.Object(
	{
		filterDocument: FilterDocument,
		categories: Type.Array(SearchCategory, {
			minItems: 1,
			maxItems: SearchCategoryValues.length,
		}),
		query: Type.Object(
			{ enabled: Type.Boolean(), required: Type.Optional(Type.Boolean()) },
			{ additionalProperties: false },
		),
		sort: Type.Object(
			{ search: SearchSortConfiguration, feed: SearchSortConfiguration },
			{ additionalProperties: false },
		),
		controls: Type.Array(ResolvedSearchControl, { maxItems: 50 }),
	},
	{ additionalProperties: false, $id: "SearchFeatureDefinition" },
);
export type SearchFeatureDefinition = Static<typeof SearchFeatureDefinition>;

export function defaultSearchSort(configuration: SearchSortConfiguration, query: string) {
	return query.trim() ? configuration.defaults.textQuery : configuration.defaults.emptyQuery;
}

function unique(values: readonly unknown[]): boolean {
	return new Set(values.map((value) => JSON.stringify(value))).size === values.length;
}

function assertFilterShape(filter: SearchControlPredicate, path: string): void {
	if (filter.field === "realm-tag-vote") {
		for (const [name, range] of [
			["score", filter.score],
			["voteCount", filter.voteCount],
		] as const)
			if (range?.lower !== undefined && range.upper !== undefined && range.lower > range.upper)
				throw new TypeError(`${path} ${name} lower bound exceeds upper bound`);
		return;
	}
	if (filter.operator === "range" && filter.lower === undefined && filter.upper === undefined)
		throw new TypeError(`${path} range requires a lower or upper bound`);
	if ("values" in filter && !unique(filter.values))
		throw new TypeError(`${path} contains duplicate values`);
}

function visitControlExpression(
	expression: SearchControlExpression,
	visitor: (value: SearchControlValue, path: string) => void,
	path = "expression",
	depth = 0,
	budget = { nodes: 0 },
): void {
	budget.nodes += 1;
	if (budget.nodes > 100) throw new TypeError("Search expression exceeds maximum 100 nodes");
	if (depth > 3) throw new TypeError("Search expression exceeds maximum depth 3");
	if ("controlKey" in expression) {
		visitor(expression, path);
		return;
	}
	if (expression.operator === "not") {
		visitControlExpression(expression.clause, visitor, `${path}.clause`, depth + 1, budget);
		return;
	}
	expression.clauses.forEach((clause, index) =>
		visitControlExpression(clause, visitor, `${path}.clauses[${index}]`, depth + 1, budget),
	);
}

function isSearchField(value: string): value is SearchField {
	return SearchFieldValues.some((field) => field === value);
}

/** Resolves the field named by a sparse control override. */
export function filterDocumentControlField(control: FilterDocumentControl): SearchField {
	if (control.field) {
		if (isSearchField(control.key) && control.key !== control.field)
			throw new TypeError(`Built-in Filter control ${control.key} cannot change field`);
		if (control.key !== control.field && control.field !== "tag")
			throw new TypeError("Only Tag controls may be repeated with a custom key");
		return control.field;
	}
	if (!isSearchField(control.key))
		throw new TypeError(`Custom Filter control ${control.key} requires a field`);
	return control.key;
}

export function assertFilterDocument(value: unknown): asserts value is FilterDocument {
	if (!Check(FilterDocument, [UnitPredicateSchema], value)) {
		const error = Value.Errors(FilterDocument, [UnitPredicateSchema], value).First();
		throw new TypeError(
			error
				? `Invalid Filter document at ${error.path || "/"}: ${error.message}`
				: "Invalid Filter document",
		);
	}
	if (value.categories && !unique(value.categories))
		throw new TypeError("Filter document categories must be unique");
	if (value.where) assertUnitPredicate(value.where);
	const controls = value.controls ?? [];
	if (!unique(controls.map((control) => control.key)))
		throw new TypeError("Filter document control keys must be unique");
	for (const [index, control] of controls.entries()) {
		filterDocumentControlField(control);
		if (control.enabled === false && control.required)
			throw new TypeError(`controls[${index}] cannot require a disabled control`);
		if (
			control.optionPolicy &&
			control.optionPolicy.kind !== "all" &&
			!unique(control.optionPolicy.values)
		)
			throw new TypeError(`controls[${index}] option policy values must be unique`);
	}
}

export function assertSearchFeatureInput(value: unknown): asserts value is SearchFeatureInput {
	if (!Check(SearchFeatureInput, [UnitPredicateSchema, UnitFilter], value))
		throw new TypeError("Invalid Search Feature input");
	assertFilterDocument(value.filterDocument);
	if (value.state.filter) assertUnitFilter(value.state.filter);
	if (!unique(value.contexts.map((context) => context.kind)))
		throw new TypeError("Search Feature contexts must have unique kinds");
	for (const [index, injection] of value.injections.entries()) {
		assertFilterShape(injection.value.filter, `injections[${index}].value.filter`);
		if (injection.source === "tag" && injection.value.filter.field !== "tag")
			throw new TypeError(`injections[${index}] tag source must target a tag control`);
	}
	if (value.state.expression)
		visitControlExpression(value.state.expression, (item, path) =>
			assertFilterShape(item.filter, `${path}.filter`),
		);
}

export function parseFilterDocument(value: unknown): FilterDocument {
	assertFilterDocument(value);
	return value;
}

/** Creates a validated sparse Filter document. Calling with no input returns `{}`. */
export function createFilterDocument(value: FilterDocument = {}): FilterDocument {
	return parseFilterDocument(value);
}

export function parseSearchFeatureInput(value: unknown): SearchFeatureInput {
	assertSearchFeatureInput(value);
	return value;
}

export function parseSearchFeatureDefinition(value: unknown): SearchFeatureDefinition {
	if (!Check(SearchFeatureDefinition, [UnitPredicateSchema], value))
		throw new TypeError("Invalid Search Feature definition");
	assertFilterDocument(value.filterDocument);
	if (!unique(value.categories)) throw new TypeError("Search categories must be unique");
	if (!value.query.enabled && value.query.required)
		throw new TypeError("Disabled Search query cannot be required");
	if (!unique(value.controls.map((control) => control.key)))
		throw new TypeError("Resolved Search control keys must be unique");
	for (const surface of SearchFeatureSurfaceValues) {
		const configuration = value.sort[surface];
		if (!unique(configuration.options))
			throw new TypeError(`Search ${surface} sorts must be unique`);
		if (!configuration.options.includes(configuration.defaults.emptyQuery))
			throw new TypeError(`Search ${surface} empty-query sort is unavailable`);
		if (!configuration.options.includes(configuration.defaults.textQuery))
			throw new TypeError(`Search ${surface} text-query sort is unavailable`);
		if (configuration.defaults.emptyQuery === "relevance")
			throw new TypeError(`Search ${surface} cannot use relevance without a query`);
	}
	if (value.sort.feed.options.includes("relevance"))
		throw new TypeError("Search Feed sorts cannot include relevance");
	return value;
}

export function parseSharedSearchQueryDocument(value: unknown): SharedSearchQueryDocument {
	if (!Check(SharedSearchQueryDocument, [UnitPredicateSchema, UnitFilter], value))
		throw new TypeError("Invalid shared Search query document");
	assertFilterDocument(value.filterDocument);
	if (
		!unique(value.selections.map((selection) => JSON.stringify([selection.field, selection.value])))
	)
		throw new TypeError("Shared Search query selections must be unique");
	if (value.state.filter) assertUnitFilter(value.state.filter);
	const referenced = new Set<string>();
	const remember = (controlValue: SearchControlValue) => {
		const { filter } = controlValue;
		if (filter.field === "realm-tag-vote") {
			referenced.add(JSON.stringify(["realm", filter.realmId]));
			referenced.add(JSON.stringify(["tag", filter.tagId]));
			return;
		}
		const values =
			"values" in filter
				? filter.values
				: "value" in filter
					? [filter.value]
					: [filter.lower, filter.upper];
		for (const scalar of values)
			if (typeof scalar === "string") referenced.add(JSON.stringify([filter.field, scalar]));
	};
	if (value.state.expression) visitControlExpression(value.state.expression, remember);
	if (
		value.selections.some(
			(selection) => !referenced.has(JSON.stringify([selection.field, selection.value])),
		)
	)
		throw new TypeError("Shared Search query selections must reference executable values");
	return value;
}

/** Canonical JSON used as the input to a server-owned cryptographic hash. */
export function canonicalSearchFeatureInput(value: unknown): string {
	assertSearchFeatureInput(value);
	const normalize = (input: unknown): unknown => {
		if (Array.isArray(input)) return input.map(normalize);
		if (!input || typeof input !== "object") return input;
		return Object.fromEntries(
			Object.entries(input)
				.filter(([, item]) => item !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, item]) => [key, normalize(item)]),
		);
	};
	return JSON.stringify(normalize(value));
}
