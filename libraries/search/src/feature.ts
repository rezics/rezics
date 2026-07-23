import { type Static, Type } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";

import type { SearchFilter as SearchFilterValue } from "./primitives";
import {
	SearchCategory,
	SearchControl,
	SearchField,
	SearchFilter,
	SearchMode,
	SearchOptionPolicy,
	SearchScope,
	SearchSort,
} from "./primitives";

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

export const SearchTemplateIdValues = ["global", "book", "media", "software"] as const;
export type SearchTemplateId = (typeof SearchTemplateIdValues)[number];
export const SearchTemplateId = Type.Union([
	Type.Literal("global"),
	Type.Literal("book"),
	Type.Literal("media"),
	Type.Literal("software"),
]);

export const SearchDisclosureValues = ["visible", "hidden"] as const;
export type SearchDisclosure = (typeof SearchDisclosureValues)[number];
export const SearchDisclosure = Type.Union([Type.Literal("visible"), Type.Literal("hidden")]);

/** A user-controlled predicate is identified by control, not merely by indexed field. */
export const SearchControlValue = Type.Object(
	{
		controlKey: SearchControlKey,
		filter: SearchFilter,
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
		modes: Type.Array(SearchMode, { minItems: 1, maxItems: 2 }),
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
		categories: Type.Array(SearchCategory, { minItems: 1, maxItems: 9 }),
		modes: Type.Object(
			{
				available: Type.Array(SearchMode, { minItems: 1, maxItems: 2 }),
				default: SearchMode,
			},
			{ additionalProperties: false },
		),
		query: Type.Object(
			{
				enabled: Type.Boolean(),
				required: Type.Optional(Type.Boolean({ default: false })),
				initial: Type.Optional(Type.String({ maxLength: 500 })),
			},
			{ additionalProperties: false },
		),
		/** Fixed document predicates; context predicates are composed separately. */
		constraints: Type.Array(SearchFilter, { maxItems: 50 }),
		defaults: Type.Array(SearchControlValue, { maxItems: 50 }),
		controls: Type.Array(SearchDocumentControl, { maxItems: 50 }),
		sections: Type.Array(SearchDocumentSection, { maxItems: 20 }),
		sort: Type.Object(
			{
				default: SearchSort,
				options: Type.Array(SearchSort, { minItems: 1, maxItems: 13 }),
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
		source: Type.Union([Type.Literal("tag"), Type.Literal("realm"), Type.Literal("link")]),
		value: SearchControlValue,
		removable: Type.Boolean({ default: true }),
	},
	{ additionalProperties: false, $id: "SearchInjection" },
);
export type SearchInjection = Static<typeof SearchInjection>;

const SearchExecutionBase = {
	query: Type.Optional(Type.String({ maxLength: 500 })),
	sort: Type.Optional(SearchSort),
	pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
	cursor: Type.Optional(Type.String({ maxLength: 4096, pattern: "^s2_[A-Za-z0-9_-]+$" })),
};

export const SearchFeatureState = Type.Union(
	[
		Type.Object(
			{
				...SearchExecutionBase,
				mode: Type.Literal("basic"),
				values: Type.Array(SearchControlValue, { maxItems: 50 }),
			},
			{ additionalProperties: false },
		),
		Type.Object(
			{
				...SearchExecutionBase,
				mode: Type.Literal("advanced"),
				expression: Type.Optional(SearchControlExpression),
			},
			{ additionalProperties: false },
		),
	],
	{ $id: "SearchFeatureState" },
);
export type SearchFeatureState = Static<typeof SearchFeatureState>;

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

function unique(values: readonly unknown[]): boolean {
	return new Set(values.map((value) => JSON.stringify(value))).size === values.length;
}

function assertFilterShape(filter: SearchFilterValue, path: string): void {
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
	if (!Check(SearchDocument, value)) throw new TypeError("Invalid Search document v1");
	if (!unique(value.categories)) throw new TypeError("Search document categories must be unique");
	if (!unique(value.modes.available)) throw new TypeError("Search document modes must be unique");
	if (!value.modes.available.includes(value.modes.default))
		throw new TypeError("Search document default mode is unavailable");
	if (!value.query.enabled && (value.query.required || value.query.initial))
		throw new TypeError("Disabled Search query cannot be required or initialized");
	if (!unique(value.controls.map((control) => control.key)))
		throw new TypeError("Search document control keys must be unique");
	if (!unique(value.sections.map((section) => section.key)))
		throw new TypeError("Search document section keys must be unique");
	if (!unique(value.sort.options)) throw new TypeError("Search document sorts must be unique");
	if (!value.sort.options.includes(value.sort.default))
		throw new TypeError("Search document default sort is unavailable");
	if (value.results.pageSize > value.results.maxPageSize)
		throw new TypeError("Search document page size exceeds its configured maximum");
	if (value.results.maxPageSize > value.results.maxResultWindow)
		throw new TypeError("Search document maximum page size exceeds its result window");

	const controls = new Map(value.controls.map((control) => [control.key, control]));
	for (const [index, control] of value.controls.entries()) {
		if (!unique(control.modes)) throw new TypeError(`controls[${index}].modes must be unique`);
		if (!control.modes.every((mode) => value.modes.available.includes(mode)))
			throw new TypeError(`controls[${index}] uses an unavailable mode`);
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
	value.constraints.forEach((filter, index) =>
		assertFilterShape(filter, `constraints[${index}]`),
	);
	if (!unique(value.defaults.map((item) => item.controlKey)))
		throw new TypeError("Search defaults must target unique controls");
	value.defaults.forEach((item, index) =>
		assertControlValue(item, controls, `defaults[${index}]`),
	);
}

export function assertSearchFeatureInput(value: unknown): asserts value is SearchFeatureInput {
	if (!Check(SearchFeatureInput, value)) throw new TypeError("Invalid Search Feature input v1");
	assertSearchDocument(value.document);
	const controls = new Map(value.document.controls.map((control) => [control.key, control]));
	if (!unique(value.contexts.map((context) => context.kind)))
		throw new TypeError("Search Feature contexts must have unique kinds");
	value.injections.forEach((injection, index) =>
		assertControlValue(injection.value, controls, `injections[${index}].value`),
	);
	for (const [index, injection] of value.injections.entries()) {
		if (injection.source === "tag" && injection.value.filter.field !== "tag")
			throw new TypeError(`injections[${index}] tag source must target a tag control`);
		if (injection.source === "realm" && injection.value.filter.field !== "realm")
			throw new TypeError(`injections[${index}] realm source must target a Realm control`);
	}
	if (value.state.mode === "basic") {
		if (!unique(value.state.values.map((item) => item.controlKey)))
			throw new TypeError("Basic Search values must target unique controls");
		value.state.values.forEach((item, index) =>
			assertControlValue(item, controls, `state.values[${index}]`),
		);
	} else if (value.state.expression) {
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
	if (!Check(SearchFeatureDefinition, value))
		throw new TypeError("Invalid Search Feature definition v1");
	assertSearchDocument(value.document);
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
