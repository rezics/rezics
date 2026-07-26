import { type Static, Type } from "@sinclair/typebox";
import { Check, Value } from "@sinclair/typebox/value";
import { UnitFilter, assertUnitFilter } from "./filter";
import { UnitPredicate as UnitPredicateSchema, assertUnitPredicate } from "./unit";

import {
	SearchCategory,
	SearchCategoryValues,
	SearchControl,
	SearchControlPredicate,
	SearchField,
	SearchOptionPolicy,
	SearchScope,
	SearchSort,
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

const SearchSectionKey = Type.String({
	minLength: 1,
	maxLength: 64,
	pattern: "^[a-z][a-z0-9-]*$",
});

export const SearchTemplateIdValues = [
	"global",
	"book",
	"media",
	"software",
	"realm",
	"zone",
] as const;
export type SearchTemplateId = (typeof SearchTemplateIdValues)[number];
export const SearchTemplateId = Type.Union([
	Type.Literal("global"),
	Type.Literal("book"),
	Type.Literal("media"),
	Type.Literal("software"),
	Type.Literal("realm"),
	Type.Literal("zone"),
]);

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
			Type.Object(
				{ operator: Type.Literal("not"), clause: This },
				{ additionalProperties: false },
			),
		]),
	{ $id: "SearchControlExpression" },
);
export type SearchControlExpression = Static<typeof SearchControlExpression>;

export const SearchDocumentControl = Type.Object(
	{
		key: SearchControlKey,
		field: SearchField,
		enabled: Type.Boolean(),
		disclosure: SearchDisclosure,
		labelUnitId: Type.Optional(Uuid),
		optionPolicy: Type.Optional(SearchOptionPolicy),
		required: Type.Optional(Type.Boolean({ default: false })),
	},
	{ additionalProperties: false, $id: "SearchDocumentControl" },
);
export type SearchDocumentControl = Static<typeof SearchDocumentControl>;

export const SearchDocumentSection = Type.Object(
	{
		key: SearchSectionKey,
		labelUnitId: Type.Optional(Uuid),
		disclosure: SearchDisclosure,
		controls: Type.Array(SearchControlKey, { minItems: 1, maxItems: 50 }),
	},
	{ additionalProperties: false, $id: "SearchDocumentSection" },
);
export type SearchDocumentSection = Static<typeof SearchDocumentSection>;

export const SearchSortConfiguration = Type.Object(
	{
		defaults: Type.Object(
			{
				emptyQuery: SearchSort,
				textQuery: SearchSort,
			},
			{ additionalProperties: false },
		),
		options: Type.Array(SearchSort, { minItems: 1, maxItems: 14 }),
	},
	{ additionalProperties: false, $id: "SearchSortConfiguration" },
);
export type SearchSortConfiguration = Static<typeof SearchSortConfiguration>;

/**
 * Versioned, engine-independent Search Feature document.
 *
 * The document chooses capabilities from a server-owned template and field
 * registry. It cannot introduce an indexed field, operator, facet, or sort.
 *
 * @todo A Zone may define a dedicated `zone.search-tags` Content Structure.
 * Its tag sections should be mounted beneath an injected-search section here,
 * without widening this contract to arbitrary JSON or engine query syntax.
 */
export const SearchDocument = Type.Object(
	{
		version: Type.Literal(1),
		template: Type.Object(
			{ id: SearchTemplateId, version: Type.Literal(1) },
			{ additionalProperties: false },
		),
		categories: Type.Array(SearchCategory, {
			minItems: 1,
			maxItems: SearchCategoryValues.length,
		}),
		query: Type.Object(
			{
				enabled: Type.Boolean(),
				required: Type.Optional(Type.Boolean({ default: false })),
			},
			{ additionalProperties: false },
		),
		/** Fixed document predicates; context predicates are composed separately. */
		filter: Type.Optional(Type.Ref(UnitPredicateSchema)),
		defaults: Type.Array(SearchControlValue, { maxItems: 50 }),
		controls: Type.Array(SearchDocumentControl, { maxItems: 50 }),
		sections: Type.Array(SearchDocumentSection, { maxItems: 20 }),
		sort: Type.Object(
			{
				search: SearchSortConfiguration,
				feed: SearchSortConfiguration,
			},
			{ additionalProperties: false },
		),
		results: Type.Object(
			{
				pageSize: Type.Integer({ minimum: 1, maximum: 50 }),
				maxPageSize: Type.Integer({ minimum: 1, maximum: 100 }),
				maxResultWindow: Type.Integer({ minimum: 1, maximum: 100_000 }),
				facets: Type.Array(SearchControlKey, { maxItems: 20 }),
			},
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false, $id: "SearchDocumentV1" },
);
export type SearchDocument = Static<typeof SearchDocument>;

export const SearchFeatureContext = Type.Union(
	[
		Type.Object(
			{ kind: Type.Literal("realm"), realmId: Uuid },
			{ additionalProperties: false },
		),
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

export const SearchFeatureState = Type.Object(
	{
		...SearchExecutionBase,
		cursor: Type.Optional(Type.String({ maxLength: 4096, pattern: "^s2_[A-Za-z0-9_-]+$" })),
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
		version: Type.Literal(1),
		template: SearchTemplateId,
		state: SharedSearchQueryState,
		selections: Type.Array(SharedSearchQuerySelection, { maxItems: 100 }),
	},
	{ additionalProperties: false, $id: "SharedSearchQueryDocumentV1" },
);
export type SharedSearchQueryDocument = Static<typeof SharedSearchQueryDocument>;

/** The complete deterministic input boundary consumed by Search Feature. */
export const SearchFeatureInput = Type.Object(
	{
		document: SearchDocument,
		contexts: Type.Array(SearchFeatureContext, { maxItems: 4 }),
		injections: Type.Array(SearchInjection, { maxItems: 50 }),
		state: SearchFeatureState,
	},
	{ additionalProperties: false, $id: "SearchFeatureInputV1" },
);
export type SearchFeatureInput = Static<typeof SearchFeatureInput>;

/** Server-resolved control metadata that is safe for a renderer to consume. */
export const ResolvedSearchControl = Type.Composite(
	[
		SearchControl,
		Type.Object({
			disclosure: SearchDisclosure,
			sectionKey: Type.Optional(SearchSectionKey),
		}),
	],
	{ additionalProperties: false, $id: "ResolvedSearchControl" },
);
export type ResolvedSearchControl = Static<typeof ResolvedSearchControl>;

export const SearchFeatureDefinition = Type.Object(
	{
		document: SearchDocument,
		controls: Type.Array(ResolvedSearchControl, { maxItems: 50 }),
	},
	{ additionalProperties: false, $id: "SearchFeatureDefinitionV1" },
);
export type SearchFeatureDefinition = Static<typeof SearchFeatureDefinition>;

export interface ResolvedSearchDocument {
	readonly document: SearchDocument;
	readonly scope: Static<typeof SearchScope>;
	readonly controls: readonly ResolvedSearchControl[];
}

export function searchSortConfiguration(
	document: SearchDocument,
	surface: SearchFeatureSurface,
): SearchSortConfiguration {
	return document.sort[surface];
}

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
			if (
				range?.lower !== undefined &&
				range.upper !== undefined &&
				range.lower > range.upper
			)
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

function assertControlValue(
	value: SearchControlValue,
	controls: ReadonlyMap<string, SearchDocumentControl>,
	path: string,
): void {
	assertFilterShape(value.filter, `${path}.filter`);
	const control = controls.get(value.controlKey);
	if (!control || !control.enabled)
		throw new TypeError(`${path} references an unavailable Search control`);
	if (control.field !== value.filter.field)
		throw new TypeError(`${path} field does not match its Search control`);
}

export function assertSearchDocument(value: unknown): asserts value is SearchDocument {
	if (!Check(SearchDocument, [UnitPredicateSchema], value)) {
		const error = Value.Errors(SearchDocument, [UnitPredicateSchema], value).First();
		throw new TypeError(
			error
				? `Invalid Search document v1 at ${error.path || "/"}: ${error.message}`
				: "Invalid Search document v1",
		);
	}
	if (!unique(value.categories)) throw new TypeError("Search document categories must be unique");
	if (!value.query.enabled && value.query.required)
		throw new TypeError("Disabled Search query cannot be required");
	if (!unique(value.controls.map((control) => control.key)))
		throw new TypeError("Search document control keys must be unique");
	if (!unique(value.sections.map((section) => section.key)))
		throw new TypeError("Search document section keys must be unique");
	for (const surface of SearchFeatureSurfaceValues) {
		const configuration = value.sort[surface];
		if (!unique(configuration.options))
			throw new TypeError(`Search document ${surface} sorts must be unique`);
		if (!configuration.options.includes(configuration.defaults.emptyQuery))
			throw new TypeError(`Search document ${surface} empty-query sort is unavailable`);
		if (!configuration.options.includes(configuration.defaults.textQuery))
			throw new TypeError(`Search document ${surface} text-query sort is unavailable`);
		if (configuration.defaults.emptyQuery === "relevance")
			throw new TypeError(`Search document ${surface} cannot use relevance without a query`);
	}
	if (value.sort.feed.options.includes("relevance"))
		throw new TypeError("Search document Feed sorts cannot include relevance");
	if (value.results.pageSize > value.results.maxPageSize)
		throw new TypeError("Search document page size exceeds its configured maximum");
	if (value.results.maxPageSize > value.results.maxResultWindow)
		throw new TypeError("Search document maximum page size exceeds its result window");

	const controls = new Map(value.controls.map((control) => [control.key, control]));
	for (const [index, control] of value.controls.entries()) {
		if (
			control.optionPolicy &&
			control.optionPolicy.kind !== "all" &&
			!unique(control.optionPolicy.values)
		)
			throw new TypeError(`controls[${index}] option policy values must be unique`);
	}
	const sectionControls = value.sections.flatMap((section) => section.controls);
	if (!unique(sectionControls))
		throw new TypeError("A Search control can belong to at most one section");
	for (const [index, controlKey] of sectionControls.entries()) {
		const control = controls.get(controlKey);
		if (!control || !control.enabled)
			throw new TypeError(`sections control ${index} is unavailable`);
	}
	if (!unique(value.results.facets))
		throw new TypeError("Search document facet control keys must be unique");
	for (const controlKey of value.results.facets) {
		const control = controls.get(controlKey);
		if (!control || !control.enabled)
			throw new TypeError(`Facet control ${controlKey} is unavailable`);
	}
	if (value.filter) assertUnitPredicate(value.filter);
	if (!unique(value.defaults.map((item) => item.controlKey)))
		throw new TypeError("Search defaults must target unique controls");
	value.defaults.forEach((item, index) =>
		assertControlValue(item, controls, `defaults[${index}]`),
	);
}

export function assertSearchFeatureInput(value: unknown): asserts value is SearchFeatureInput {
	if (!Check(SearchFeatureInput, [UnitPredicateSchema, UnitFilter], value))
		throw new TypeError("Invalid Search Feature input v1");
	assertSearchDocument(value.document);
	if (value.state.filter) assertUnitFilter(value.state.filter);
	const controls = new Map(value.document.controls.map((control) => [control.key, control]));
	if (!unique(value.contexts.map((context) => context.kind)))
		throw new TypeError("Search Feature contexts must have unique kinds");
	value.injections.forEach((injection, index) =>
		assertControlValue(injection.value, controls, `injections[${index}].value`),
	);
	for (const [index, injection] of value.injections.entries()) {
		if (injection.source === "tag" && injection.value.filter.field !== "tag")
			throw new TypeError(`injections[${index}] tag source must target a tag control`);
	}
	if (value.state.expression) {
		visitControlExpression(value.state.expression, (item, path) =>
			assertControlValue(item, controls, path),
		);
	}
}

export function parseSearchDocument(value: unknown): SearchDocument {
	assertSearchDocument(value);
	return value;
}

export function parseSearchFeatureInput(value: unknown): SearchFeatureInput {
	assertSearchFeatureInput(value);
	return value;
}

export function parseSearchFeatureDefinition(value: unknown): SearchFeatureDefinition {
	if (!Check(SearchFeatureDefinition, [UnitPredicateSchema], value))
		throw new TypeError("Invalid Search Feature definition v1");
	assertSearchDocument(value.document);
	return value;
}

export function parseSharedSearchQueryDocument(value: unknown): SharedSearchQueryDocument {
	if (!Check(SharedSearchQueryDocument, [UnitPredicateSchema, UnitFilter], value))
		throw new TypeError("Invalid shared Search query document v1");
	if (
		!unique(
			value.selections.map((selection) => JSON.stringify([selection.field, selection.value])),
		)
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
