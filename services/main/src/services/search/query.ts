import { type Static, Type } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";
import {
	type UnitPredicate,
	SearchCategoryValues,
	SearchControlPredicate,
	type SearchCategory as SearchCategoryValue,
	type SearchField as SearchFieldValue,
	type SearchScope as SearchScopeValue,
	type SearchSort as SearchSortValue,
} from "@rezics/filter";

type SearchCategory = SearchCategoryValue;
type SearchField = SearchFieldValue;
type SearchScope = SearchScopeValue;
type SearchSort = SearchSortValue;

export const SearchExpression = Type.Recursive(
	(This) =>
		Type.Union([
			SearchControlPredicate,
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

export interface CompiledSearchRequest {
	readonly scope: SearchScope;
	readonly categories: readonly SearchCategory[];
	readonly query: string;
	readonly constraints: readonly SearchControlPredicate[];
	readonly searchExpression?: SearchExpression;
	readonly domainFilter?: UnitPredicate;
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
	if ("values" in filter && !unique(filter.values.map((value) => JSON.stringify(value))))
		throw new TypeError(`${path} contains duplicate values`);
}

function visitExpression(
	expression: SearchExpression,
	visitor: (filter: SearchControlPredicate, path: string) => void,
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
