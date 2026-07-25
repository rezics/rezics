import { type Static, Type } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";
import type { UnitFilter } from "@rezics/filter";
import {
	SearchCategory as SearchCategorySchema,
	SearchCategoryValues,
	SearchControl as SearchControlSchema,
	SearchField as SearchFieldSchema,
	SearchFilter as SearchFilterSchema,
	SearchMode as SearchModeSchema,
	SearchScope as SearchScopeSchema,
	SearchSort as SearchSortSchema,
	type SearchCategory as SearchCategoryValue,
	type SearchControl as SearchControlValue,
	type SearchField as SearchFieldValue,
	type SearchFilter as SearchFilterValue,
	type SearchMode as SearchModeValue,
	type SearchScalar as SearchScalarValue,
	type SearchScope as SearchScopeValue,
	type SearchSort as SearchSortValue,
} from "./primitives";

export * from "./primitives";

type SearchCategory = SearchCategoryValue;
type SearchControl = SearchControlValue;
type SearchField = SearchFieldValue;
type SearchFilter = SearchFilterValue;
type SearchMode = SearchModeValue;
type SearchScalar = SearchScalarValue;
type SearchScope = SearchScopeValue;
type SearchSort = SearchSortValue;

export const SearchExpression = Type.Recursive(
	(This) =>
		Type.Union([
			SearchFilterSchema,
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
	{ $id: "SearchExpression" },
);
export type SearchExpression = Static<typeof SearchExpression>;

export interface SearchExpressionValidationLimits {
	readonly maxDepth: number;
	readonly maxNodes: number;
}

export const DefaultSearchExpressionValidationLimits: SearchExpressionValidationLimits = {
	maxDepth: 3,
	maxNodes: 100,
};

export function combineSearchExpressions(
	operator: "all" | "any",
	expressions: readonly SearchExpression[],
): SearchExpression | undefined {
	const clauses = expressions.flatMap((expression) =>
		!("field" in expression) && expression.operator === operator
			? expression.clauses
			: [expression],
	);
	if (!clauses.length) return undefined;
	const build = (items: readonly SearchExpression[]): SearchExpression => {
		if (items.length === 1) return items[0]!;
		if (items.length <= 20) return { operator, clauses: [...items] };
		const groups: SearchExpression[] = [];
		for (let index = 0; index < items.length; index += 20)
			groups.push({ operator, clauses: items.slice(index, index + 20) });
		return build(groups);
	};
	return build(clauses);
}

export const SearchConfiguration = Type.Object(
	{
		scope: SearchScopeSchema,
		categories: Type.Array(SearchCategorySchema, { minItems: 1, maxItems: 9 }),
		modes: Type.Object(
			{
				available: Type.Array(SearchModeSchema, { minItems: 1, maxItems: 2 }),
				default: SearchModeSchema,
			},
			{ additionalProperties: false },
		),
		query: Type.Object(
			{
				enabled: Type.Boolean({ default: true }),
				required: Type.Optional(Type.Boolean({ default: false })),
			},
			{ additionalProperties: false },
		),
		/** Invisible server-enforced predicates. User input can never replace these. */
		constraints: Type.Array(SearchFilterSchema, { maxItems: 50 }),
		/** Initial, user-changeable predicates. Each one must have a matching control. */
		defaults: Type.Array(SearchFilterSchema, { maxItems: 50 }),
		/** Controls are the complete render allow-list; omitted controls stay hidden. */
		controls: Type.Array(SearchControlSchema, { maxItems: 50 }),
		sort: Type.Object(
			{
				default: SearchSortSchema,
				options: Type.Array(SearchSortSchema, { minItems: 1, maxItems: 13 }),
			},
			{ additionalProperties: false },
		),
		results: Type.Object(
			{
				pageSize: Type.Integer({ minimum: 1, maximum: 50 }),
				maxPageSize: Type.Integer({ minimum: 1, maximum: 100 }),
				maxResultWindow: Type.Integer({ minimum: 1, maximum: 100_000 }),
				facets: Type.Array(SearchFieldSchema, { maxItems: 20 }),
			},
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false, $id: "SearchConfiguration" },
);
export type SearchConfiguration = Static<typeof SearchConfiguration>;

const SearchRequestBase = {
	query: Type.Optional(Type.String({ maxLength: 500 })),
	sort: Type.Optional(SearchSortSchema),
	pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
	cursor: Type.Optional(Type.String({ maxLength: 4096, pattern: "^s2_[A-Za-z0-9_-]+$" })),
};

export const SearchExecutionRequest = Type.Union(
	[
		Type.Object(
			{
				...SearchRequestBase,
				mode: Type.Literal("basic"),
				filters: Type.Array(SearchFilterSchema, { maxItems: 50 }),
			},
			{ additionalProperties: false },
		),
		Type.Object(
			{
				...SearchRequestBase,
				mode: Type.Literal("advanced"),
				expression: Type.Optional(SearchExpression),
			},
			{ additionalProperties: false },
		),
	],
	{ $id: "SearchExecutionRequest" },
);
export type SearchExecutionRequest = Static<typeof SearchExecutionRequest>;

export interface CompiledSearchRequest {
	readonly scope: SearchScope;
	readonly categories: readonly SearchCategory[];
	readonly mode: SearchMode;
	readonly query: string;
	readonly constraints: readonly SearchFilter[];
	readonly searchExpression?: SearchExpression;
	readonly domainFilter?: UnitFilter;
	readonly sort: SearchSort;
	readonly pageSize: number;
	readonly maxResultWindow: number;
	readonly cursor?: string;
	readonly facets: readonly SearchField[];
}

export interface SearchCursorState {
	readonly version: 2;
	readonly generationId: string;
	readonly requestHash: string;
	readonly pageSize: number;
	readonly categories: Readonly<
		Record<string, { readonly offset: number; readonly exhausted: boolean }>
	>;
}

const Base64UrlAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function encodeBase64Url(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let encoded = "";
	for (let index = 0; index < bytes.length; index += 3) {
		const first = bytes[index] ?? 0;
		const second = bytes[index + 1];
		const third = bytes[index + 2];
		encoded += Base64UrlAlphabet[first >> 2];
		encoded += Base64UrlAlphabet[((first & 3) << 4) | ((second ?? 0) >> 4)];
		if (second !== undefined)
			encoded += Base64UrlAlphabet[((second & 15) << 2) | ((third ?? 0) >> 6)];
		if (third !== undefined) encoded += Base64UrlAlphabet[third & 63];
	}
	return encoded;
}

function decodeBase64Url(value: string): string {
	if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1)
		throw new TypeError("Invalid Search cursor");
	const bytes: number[] = [];
	for (let index = 0; index < value.length; index += 4) {
		const digits = [...value.slice(index, index + 4)].map((character) =>
			Base64UrlAlphabet.indexOf(character),
		);
		if (digits.some((digit) => digit < 0)) throw new TypeError("Invalid Search cursor");
		const [first = 0, second = 0, third, fourth] = digits;
		bytes.push((first << 2) | (second >> 4));
		if (third !== undefined) bytes.push(((second & 15) << 4) | (third >> 2));
		if (third !== undefined && fourth !== undefined) bytes.push(((third & 3) << 6) | fourth);
	}
	return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
}

/** The cursor is opaque to callers but fully validated before server-side use. */
export function createSearchCursor(state: SearchCursorState): string {
	assertSearchCursorState(state);
	return `s2_${encodeBase64Url(JSON.stringify(state))}`;
}

export function parseSearchCursor(value: string): SearchCursorState {
	if (!value.startsWith("s2_")) throw new TypeError("Invalid Search cursor");
	let decoded: unknown;
	try {
		decoded = JSON.parse(decodeBase64Url(value.slice(3)));
	} catch {
		throw new TypeError("Invalid Search cursor");
	}
	assertSearchCursorState(decoded);
	return decoded;
}

function assertSearchCursorState(value: unknown): asserts value is SearchCursorState {
	if (!value || typeof value !== "object") throw new TypeError("Invalid Search cursor");
	const candidate = value as Record<string, unknown>;
	if (
		candidate.version !== 2 ||
		typeof candidate.generationId !== "string" ||
		!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
			candidate.generationId,
		) ||
		typeof candidate.requestHash !== "string" ||
		!/^[0-9a-f]{64}$/.test(candidate.requestHash) ||
		!Number.isSafeInteger(candidate.pageSize) ||
		(candidate.pageSize as number) < 1 ||
		(candidate.pageSize as number) > 100 ||
		!candidate.categories ||
		typeof candidate.categories !== "object" ||
		Array.isArray(candidate.categories)
	)
		throw new TypeError("Invalid Search cursor");
	for (const [category, state] of Object.entries(candidate.categories)) {
		if (
			!SearchCategoryValues.includes(category as SearchCategory) ||
			!state ||
			typeof state !== "object"
		)
			throw new TypeError("Invalid Search cursor");
		const position = state as Record<string, unknown>;
		if (
			!Number.isSafeInteger(position.offset) ||
			(position.offset as number) < 0 ||
			typeof position.exhausted !== "boolean"
		)
			throw new TypeError("Invalid Search cursor");
	}
}

function unique<T>(values: readonly T[]): boolean {
	return new Set(values).size === values.length;
}

function filterValues(filter: SearchFilter): readonly SearchScalar[] {
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

function optionAllows(control: SearchControl, filter: SearchFilter): boolean {
	if (
		control.optionSource?.kind === "static" &&
		!filterValues(filter).every((value) =>
			control.optionSource?.kind === "static"
				? control.optionSource.options.some((option) => sameScalar(option.value, value))
				: false,
		)
	)
		return false;
	const policy = control.optionPolicy;
	if (!policy || policy.kind === "all") return true;
	return filterValues(filter).every((value) => {
		const listed = policy.values.some((allowed) => sameScalar(allowed, value));
		return policy.kind === "include" ? listed : !listed;
	});
}

function assertFilterShape(filter: SearchFilter, path: string): void {
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
	if ("values" in filter && !unique(filter.values.map((value) => JSON.stringify(value))))
		throw new TypeError(`${path} contains duplicate values`);
}

function assertFilterAllowed(
	filter: SearchFilter,
	controls: readonly SearchControl[],
	mode: SearchMode,
	path: string,
): void {
	assertFilterShape(filter, path);
	const control = controls.find(
		(candidate) => candidate.field === filter.field && candidate.modes.includes(mode),
	);
	if (!control)
		throw new TypeError(`${path} field ${filter.field} is not exposed in ${mode} mode`);
	if (!control.operators.includes(filter.operator))
		throw new TypeError(`${path} operator ${filter.operator} is not allowed`);
	if (!optionAllows(control, filter)) throw new TypeError(`${path} uses a hidden option`);
}

function visitExpression(
	expression: SearchExpression,
	visitor: (filter: SearchFilter, path: string) => void,
	path = "expression",
	depth = 0,
	budget = { nodes: 0 },
	limits: SearchExpressionValidationLimits = DefaultSearchExpressionValidationLimits,
): void {
	budget.nodes += 1;
	if (budget.nodes > limits.maxNodes)
		throw new TypeError(`Search expression exceeds maximum ${limits.maxNodes} nodes`);
	if (depth > limits.maxDepth)
		throw new TypeError(`Search expression exceeds maximum depth ${limits.maxDepth}`);
	if ("field" in expression) {
		visitor(expression, path);
		return;
	}
	if (expression.operator === "not") {
		visitExpression(expression.clause, visitor, `${path}.clause`, depth + 1, budget, limits);
		return;
	}
	expression.clauses.forEach((clause, index) =>
		visitExpression(clause, visitor, `${path}.clauses[${index}]`, depth + 1, budget, limits),
	);
}

function expressionFields(expression: SearchExpression | undefined): Set<SearchField> {
	const fields = new Set<SearchField>();
	if (expression)
		visitExpression(expression, (filter) => {
			fields.add(filter.field);
		});
	return fields;
}

export function assertSearchExpression(
	value: unknown,
	limits: SearchExpressionValidationLimits = DefaultSearchExpressionValidationLimits,
): asserts value is SearchExpression {
	if (!Check(SearchExpression, value)) throw new TypeError("Invalid Search expression");
	visitExpression(value, assertFilterShape, "searchExpression", 0, { nodes: 0 }, limits);
}

export function parseSearchExpression(
	value: unknown,
	limits: SearchExpressionValidationLimits = DefaultSearchExpressionValidationLimits,
): SearchExpression {
	assertSearchExpression(value, limits);
	return value;
}

export function assertSearchConfiguration(value: unknown): asserts value is SearchConfiguration {
	if (!Check(SearchConfiguration, value)) throw new TypeError("Invalid Search configuration");
	if (!unique(value.categories)) throw new TypeError("Search categories must be unique");
	if (!unique(value.modes.available)) throw new TypeError("Search modes must be unique");
	if (!value.modes.available.includes(value.modes.default))
		throw new TypeError("Default Search mode is unavailable");
	if (!unique(value.controls.map((control) => control.key)))
		throw new TypeError("Search control keys must be unique");
	const controlModes = value.controls.flatMap((control) =>
		control.modes.map((mode) => `${control.field}:${mode}`),
	);
	if (!unique(controlModes))
		throw new TypeError("A Search field can have at most one control in each mode");
	if (!unique(value.sort.options)) throw new TypeError("Search sort options must be unique");
	if (!value.sort.options.includes(value.sort.default))
		throw new TypeError("Default Search sort is unavailable");
	if (value.results.pageSize > value.results.maxPageSize)
		throw new TypeError("Search page size exceeds its configured maximum");
	if (value.results.maxPageSize > value.results.maxResultWindow)
		throw new TypeError("Search page size maximum exceeds its result window");
	if (!unique(value.results.facets)) throw new TypeError("Search facets must be unique");
	if (!value.query.enabled && value.query.required)
		throw new TypeError("Disabled Search query cannot be required");
	if (!unique(value.defaults.map((filter) => filter.field)))
		throw new TypeError("Search defaults must target unique fields");
	for (const [index, control] of value.controls.entries()) {
		if (!unique(control.modes)) throw new TypeError(`controls[${index}].modes must be unique`);
		if (!control.modes.every((mode) => value.modes.available.includes(mode)))
			throw new TypeError(`controls[${index}] uses an unavailable mode`);
		if (!unique(control.operators))
			throw new TypeError(`controls[${index}].operators must be unique`);
		if (control.optionSource?.kind === "static") {
			const optionValues = control.optionSource.options.map((option) =>
				JSON.stringify(option.value),
			);
			if (!unique(optionValues))
				throw new TypeError(`controls[${index}] static options must be unique`);
			if (
				control.optionPolicy &&
				control.optionPolicy.kind !== "all" &&
				!control.optionPolicy.values.every((value) =>
					control.optionSource?.kind === "static"
						? control.optionSource.options.some((option) =>
								sameScalar(option.value, value),
							)
						: false,
				)
			)
				throw new TypeError(
					`controls[${index}] option policy references an unknown option`,
				);
		}
		if (
			control.optionPolicy &&
			control.optionPolicy.kind !== "all" &&
			!unique(control.optionPolicy.values.map((value) => JSON.stringify(value)))
		)
			throw new TypeError(`controls[${index}] option policy values must be unique`);
	}
	value.constraints.forEach((filter, index) =>
		assertFilterShape(filter, `constraints[${index}]`),
	);
	value.defaults.forEach((filter, index) => {
		for (const mode of value.modes.available)
			assertFilterAllowed(filter, value.controls, mode, `defaults[${index}]`);
	});
}

/**
 * Compile UI state against a trusted configuration. Configuration is loaded by
 * the server (for example from a Search Block); it is never accepted as request
 * authority. Engine adapters consume this canonical result, not raw user DSL.
 */
export function compileSearchRequest(
	configurationValue: unknown,
	requestValue: unknown,
): CompiledSearchRequest {
	assertSearchConfiguration(configurationValue);
	if (!Check(SearchExecutionRequest, requestValue))
		throw new TypeError("Invalid Search execution request");
	const configuration = configurationValue;
	const request = requestValue;
	if (!configuration.modes.available.includes(request.mode))
		throw new TypeError(`Search mode ${request.mode} is unavailable`);
	if (!configuration.query.enabled && request.query)
		throw new TypeError("This Search configuration does not accept a query");
	const query = request.query ?? "";
	if (configuration.query.required && !query.trim())
		throw new TypeError("Search query is required");
	if (request.sort && !configuration.sort.options.includes(request.sort))
		throw new TypeError(`Search sort ${request.sort} is unavailable`);
	if (request.pageSize && request.pageSize > configuration.results.maxPageSize)
		throw new TypeError("Requested Search page size exceeds the configured maximum");

	if (request.mode === "basic")
		request.filters.forEach((filter, index) =>
			assertFilterAllowed(filter, configuration.controls, "basic", `filters[${index}]`),
		);
	else if (request.expression)
		visitExpression(request.expression, (filter, path) =>
			assertFilterAllowed(filter, configuration.controls, "advanced", path),
		);

	const suppliedFields =
		request.mode === "basic"
			? new Set(request.filters.map((filter) => filter.field))
			: expressionFields(request.expression);
	const effectiveDefaults = configuration.defaults.filter(
		(filter) => !suppliedFields.has(filter.field),
	);
	const effectiveFields = new Set([
		...suppliedFields,
		...effectiveDefaults.map((filter) => filter.field),
	]);
	for (const control of configuration.controls)
		if (
			control.modes.includes(request.mode) &&
			control.required &&
			!effectiveFields.has(control.field)
		)
			throw new TypeError(`Required Search field ${control.field} is missing`);
	return {
		scope: configuration.scope,
		categories: configuration.categories,
		mode: request.mode,
		query,
		constraints:
			request.mode === "basic"
				? [...configuration.constraints, ...effectiveDefaults, ...request.filters]
				: [...configuration.constraints, ...effectiveDefaults],
		searchExpression: request.mode === "advanced" ? request.expression : undefined,
		sort: request.sort ?? configuration.sort.default,
		pageSize: request.pageSize ?? configuration.results.pageSize,
		maxResultWindow: configuration.results.maxResultWindow,
		cursor: request.cursor,
		facets: configuration.results.facets,
	};
}

export * from "./feature";
