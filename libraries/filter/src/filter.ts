import { type Static, Type } from "typebox";
import { Check } from "typebox/value";

import {
	DefaultFilterValidationLimits,
	type FilterValidationLimits,
	UnitPredicate,
	UnitPredicateSchemaModels,
	assertUnitPredicate,
	canonicalUnitPredicate,
	type UnitPredicate as UnitPredicateValue,
} from "./unit";

export const SearchMatch = Type.Object(
	{
		query: Type.String({ minLength: 1, maxLength: 500 }),
	},
	{ additionalProperties: false, $id: "SearchMatch" },
);
export type SearchMatch = Static<typeof SearchMatch>;

/**
 * Complete Unit selection contract.
 *
 * Search is a positive, service-backed match constraint. Keeping it outside
 * the recursive predicate makes cross-engine OR/NOT and relevance semantics
 * impossible to express accidentally.
 */
export const UnitFilter = Type.Union(
	[
		Type.Object(
			{
				search: SearchMatch,
				where: Type.Optional(Type.Unsafe<UnitPredicateValue>(UnitPredicate)),
			},
			{ additionalProperties: false },
		),
		Type.Object(
			{ where: Type.Unsafe<UnitPredicateValue>(UnitPredicate) },
			{ additionalProperties: false },
		),
	],
	{ $id: "UnitFilter" },
);
export type UnitFilter = Static<typeof UnitFilter>;

export const FilterSchemaModels = {
	...UnitPredicateSchemaModels,
	SearchMatch,
	UnitFilter,
} as const;

export function assertUnitFilter(
	value: unknown,
	limits: FilterValidationLimits = DefaultFilterValidationLimits,
): asserts value is UnitFilter {
	if (!Check(UnitPredicateSchemaModels, UnitFilter, value))
		throw new TypeError("Invalid Unit filter");
	if (value.where) assertUnitPredicate(value.where, limits);
	if ("search" in value && !value.search.query.trim())
		throw new TypeError("Search query cannot be blank");
}

export function parseUnitFilter(
	value: unknown,
	limits: FilterValidationLimits = DefaultFilterValidationLimits,
): UnitFilter {
	assertUnitFilter(value, limits);
	return value;
}

export function canonicalUnitFilter(value: unknown): string {
	assertUnitFilter(value);
	const filter = value as UnitFilter;
	return JSON.stringify({
		...("search" in filter ? { search: { query: filter.search.query.trim() } } : {}),
		...(filter.where ? { where: JSON.parse(canonicalUnitPredicate(filter.where)) } : {}),
	});
}

export function combineUnitPredicates(
	predicates: readonly (UnitPredicateValue | undefined)[],
): UnitPredicateValue | undefined {
	const unique = new Map<string, UnitPredicateValue>();
	for (const predicate of predicates)
		if (predicate !== undefined) unique.set(canonicalUnitPredicate(predicate), predicate);
	const present = [...unique.values()];
	if (!present.length) return undefined;
	const combined: UnitPredicateValue = present.length === 1 ? present[0]! : { all: present };
	assertUnitPredicate(combined);
	return combined;
}

export function mergeUnitFilter(
	filter: UnitFilter | undefined,
	where: UnitPredicateValue | undefined,
): UnitFilter | undefined {
	const combinedWhere = combineUnitPredicates([filter?.where, where]);
	if (filter && "search" in filter)
		return {
			search: filter.search,
			...(combinedWhere ? { where: combinedWhere } : {}),
		};
	return combinedWhere ? { where: combinedWhere } : undefined;
}

export function unitFilterSearchQuery(filter: UnitFilter | undefined): string {
	return filter && "search" in filter ? filter.search.query : "";
}

export function withUnitFilterSearch(
	filter: UnitFilter | undefined,
	query: string,
): UnitFilter | undefined {
	const normalized = query.trim();
	if (normalized)
		return {
			search: { query: normalized },
			...(filter?.where ? { where: filter.where } : {}),
		};
	return filter?.where ? { where: filter.where } : undefined;
}
