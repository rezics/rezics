import type {
	SearchCategory,
	SearchControlPredicate,
	SearchField,
	SearchOperator,
	SearchScalar,
	SearchSort,
} from "@rezics/filter";
import { SearchCategoryValues } from "@rezics/filter";

import { InvalidSearch } from "./errors";

export type SearchScalarKind =
	| "boolean"
	| "date"
	| "integer"
	| "string"
	| "uuid"
	| "realm-tag-vote";
export type SearchFacetPolicy = "none" | "meili-low-cardinality" | "postgres-authorized";
export type SearchSortPolicy = "none" | "meili" | "postgres-residual";

export interface SearchFieldDefinition {
	readonly categories: readonly SearchCategory[];
	readonly unitTypes?: readonly string[];
	readonly scalar: SearchScalarKind;
	readonly operators: readonly SearchOperator[];
	readonly facet: SearchFacetPolicy;
	readonly sort: SearchSortPolicy;
	readonly documentPath: string;
	readonly postgres: readonly ("equality" | "comparison")[];
	readonly residual: boolean;
	readonly applicabilityPath?: string;
}

export interface SearchSortDefinition {
	readonly categories: readonly SearchCategory[];
	readonly requiresQuery: boolean;
	readonly postgres: readonly string[];
}

const allCategories: readonly SearchCategory[] = [
	"units",
	"users",
	"entities",
	"tags",
	"posts",
	"realms",
	"collections",
	"reviews",
	"polls",
];
const equality = ["equals", "not-equals", "any-of", "all-of", "none-of"] as const;
const range = ["range", "exists"] as const;

export const CurrentSearchFieldRegistry = {
	category: {
		categories: allCategories,
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "category",
		postgres: ["equality"],
		residual: false,
	},
	kind: {
		categories: ["units", "entities", "posts", "reviews"],
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "searchKind",
		postgres: ["equality"],
		residual: false,
	},
	language: {
		categories: allCategories,
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "languages",
		postgres: ["equality"],
		residual: false,
	},
	"content-rating": {
		categories: allCategories,
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "filters.contentRating",
		postgres: ["equality"],
		residual: false,
	},
	"ai-disclosure": {
		categories: allCategories,
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "filters.aiDisclosure",
		postgres: ["equality"],
		residual: false,
	},
	license: {
		categories: allCategories,
		scalar: "string",
		operators: [...equality, "exists"],
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.license",
		postgres: ["equality"],
		residual: false,
	},
	tag: {
		categories: allCategories,
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.tagIds",
		postgres: ["equality"],
		residual: false,
	},
	credit: {
		categories: allCategories,
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.creditedUnitIds",
		postgres: ["equality"],
		residual: false,
	},
	"credited-profile": {
		categories: allCategories,
		scalar: "uuid",
		operators: equality,
		facet: "none",
		sort: "none",
		documentPath: "filters.creditedProfileIds",
		postgres: ["equality"],
		residual: true,
	},
	realm: {
		categories: allCategories,
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.realmIds",
		postgres: ["equality"],
		residual: false,
	},
	"realm-tag-context": {
		categories: ["tags"],
		scalar: "uuid",
		operators: ["equals"],
		facet: "none",
		sort: "none",
		documentPath: "filters.realmTagContextRealmIds",
		postgres: ["equality"],
		residual: true,
	},
	"realm-tag-vote": {
		categories: allCategories,
		scalar: "realm-tag-vote",
		operators: ["matches"],
		facet: "none",
		sort: "none",
		documentPath: "filters.realmTagVoteKeys",
		postgres: ["equality"],
		residual: true,
	},
	zone: {
		categories: allCategories,
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.scopeOwnerIds",
		postgres: [],
		residual: true,
	},
	subject: {
		categories: ["posts"],
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.subjectId",
		postgres: ["equality"],
		residual: false,
	},
	target: {
		categories: ["reviews"],
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.subjectId",
		postgres: ["equality"],
		residual: false,
	},
	root: {
		categories: ["posts"],
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.rootId",
		postgres: ["equality"],
		residual: false,
	},
	parent: {
		categories: ["posts"],
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.parentId",
		postgres: ["equality"],
		residual: false,
	},
	owner: {
		categories: ["units", "entities", "realms", "collections"],
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.ownerProfileIds",
		postgres: ["equality"],
		residual: false,
	},
	"join-policy": {
		categories: ["realms"],
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "filters.joinPolicy",
		postgres: ["equality"],
		residual: false,
	},
	multiple: {
		categories: ["polls"],
		scalar: "boolean",
		operators: ["equals", "not-equals"],
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "filters.pollMode",
		postgres: [],
		residual: true,
	},
	"results-visibility": {
		categories: ["polls"],
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "filters.resultsVisibility",
		postgres: ["equality"],
		residual: false,
	},
	closed: {
		categories: ["polls"],
		scalar: "boolean",
		operators: ["equals", "not-equals"],
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "filters.closesAt",
		postgres: [],
		residual: true,
	},
	"created-at": {
		categories: allCategories,
		scalar: "date",
		operators: range,
		facet: "none",
		sort: "meili",
		documentPath: "ranking.createdAt",
		postgres: ["comparison"],
		residual: false,
	},
	"updated-at": {
		categories: allCategories,
		scalar: "date",
		operators: range,
		facet: "none",
		sort: "meili",
		documentPath: "ranking.updatedAt",
		postgres: ["comparison"],
		residual: false,
	},
	"published-at": {
		categories: allCategories,
		scalar: "date",
		operators: range,
		facet: "none",
		sort: "meili",
		documentPath: "ranking.publishedAt",
		postgres: ["comparison"],
		residual: false,
	},
	"closes-at": {
		categories: ["polls"],
		scalar: "date",
		operators: range,
		facet: "none",
		sort: "meili",
		documentPath: "filters.closesAt",
		postgres: ["comparison"],
		residual: false,
	},
	"content-license": {
		categories: ["units"],
		unitTypes: ["book", "media", "software"],
		scalar: "boolean",
		operators: ["equals", "not-equals"],
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "contentLicense.active",
		postgres: ["equality"],
		residual: false,
		applicabilityPath: "unitType",
	},
	"book-isbn13": {
		categories: ["units"],
		unitTypes: ["book"],
		scalar: "string",
		operators: [...equality, "exists"],
		facet: "none",
		sort: "none",
		documentPath: "book.isbn13",
		postgres: ["equality"],
		residual: false,
		applicabilityPath: "unitType",
	},
	"book-publication-date": {
		categories: ["units"],
		unitTypes: ["book"],
		scalar: "date",
		operators: range,
		facet: "none",
		sort: "meili",
		documentPath: "book.publicationAt",
		postgres: ["comparison"],
		residual: false,
		applicabilityPath: "unitType",
	},
	"book-page-count": {
		categories: ["units"],
		unitTypes: ["book"],
		scalar: "integer",
		operators: range,
		facet: "none",
		sort: "meili",
		documentPath: "book.pageCount",
		postgres: ["comparison"],
		residual: false,
		applicabilityPath: "unitType",
	},
	"book-word-count": {
		categories: ["units"],
		unitTypes: ["book"],
		scalar: "integer",
		operators: range,
		facet: "none",
		sort: "none",
		documentPath: "book.wordCount",
		postgres: [],
		residual: true,
		applicabilityPath: "unitType",
	},
	"book-format": {
		categories: ["units"],
		unitTypes: ["book"],
		scalar: "string",
		operators: [...equality, "exists"],
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "book.format",
		postgres: ["equality"],
		residual: false,
		applicabilityPath: "unitType",
	},
	"media-kind": {
		categories: ["units"],
		unitTypes: ["media"],
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "media.kind",
		postgres: ["equality"],
		residual: false,
		applicabilityPath: "unitType",
	},
	"media-release-date": {
		categories: ["units"],
		unitTypes: ["media"],
		scalar: "date",
		operators: range,
		facet: "none",
		sort: "meili",
		documentPath: "media.releaseAt",
		postgres: ["comparison"],
		residual: false,
		applicabilityPath: "unitType",
	},
	"media-runtime-minutes": {
		categories: ["units"],
		unitTypes: ["media"],
		scalar: "integer",
		operators: range,
		facet: "none",
		sort: "meili",
		documentPath: "media.runtimeMinutes",
		postgres: ["comparison"],
		residual: false,
		applicabilityPath: "unitType",
	},
	"media-episode-count": {
		categories: ["units"],
		unitTypes: ["media"],
		scalar: "integer",
		operators: range,
		facet: "none",
		sort: "none",
		documentPath: "media.episodeCount",
		postgres: ["comparison"],
		residual: false,
		applicabilityPath: "unitType",
	},
	"media-season-count": {
		categories: ["units"],
		unitTypes: ["media"],
		scalar: "integer",
		operators: range,
		facet: "none",
		sort: "none",
		documentPath: "media.seasonCount",
		postgres: ["comparison"],
		residual: false,
		applicabilityPath: "unitType",
	},
	"software-release-date": {
		categories: ["units"],
		unitTypes: ["software"],
		scalar: "date",
		operators: range,
		facet: "none",
		sort: "meili",
		documentPath: "software.releaseAt",
		postgres: ["comparison"],
		residual: false,
		applicabilityPath: "unitType",
	},
	"software-version-label": {
		categories: ["units"],
		unitTypes: ["software"],
		scalar: "string",
		operators: [...equality, "exists"],
		facet: "none",
		sort: "none",
		documentPath: "software.versionLabel",
		postgres: ["equality"],
		residual: false,
		applicabilityPath: "unitType",
	},
	"software-platform": {
		categories: ["units"],
		unitTypes: ["software"],
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "software.platformIds",
		postgres: ["equality"],
		residual: false,
		applicabilityPath: "unitType",
	},
	"software-requirement-tier": {
		categories: ["units"],
		unitTypes: ["software"],
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "software.requirementTiers",
		postgres: ["equality"],
		residual: true,
		applicabilityPath: "unitType",
	},
} as const satisfies Readonly<Record<SearchField, SearchFieldDefinition>>;

export const CurrentSearchSortRegistry = {
	best: {
		categories: SearchCategoryValues,
		requiresQuery: false,
		postgres: ["ranking.recommendationBest:desc", "ranking.updatedAt:desc", "id:asc"],
	},
	relevance: {
		categories: SearchCategoryValues,
		requiresQuery: true,
		postgres: [],
	},
	"createdAt:asc": {
		categories: SearchCategoryValues,
		requiresQuery: false,
		postgres: ["ranking.createdAt:asc", "id:asc"],
	},
	"createdAt:desc": {
		categories: SearchCategoryValues,
		requiresQuery: false,
		postgres: ["ranking.createdAt:desc", "id:asc"],
	},
	"updatedAt:asc": {
		categories: SearchCategoryValues,
		requiresQuery: false,
		postgres: ["ranking.updatedAt:asc", "id:asc"],
	},
	"updatedAt:desc": {
		categories: SearchCategoryValues,
		requiresQuery: false,
		postgres: ["ranking.updatedAt:desc", "id:asc"],
	},
	"publishedAt:asc": {
		categories: ["units"],
		requiresQuery: false,
		postgres: ["ranking.publishedAt:asc", "id:asc"],
	},
	"publishedAt:desc": {
		categories: ["units"],
		requiresQuery: false,
		postgres: ["ranking.publishedAt:desc", "id:asc"],
	},
	"followerCount:asc": {
		categories: ["users", "realms"],
		requiresQuery: false,
		postgres: ["ranking.followerCount:asc", "id:asc"],
	},
	"followerCount:desc": {
		categories: ["users", "realms"],
		requiresQuery: false,
		postgres: ["ranking.followerCount:desc", "id:asc"],
	},
	"replyCount:asc": {
		categories: ["posts"],
		requiresQuery: false,
		postgres: ["ranking.replyCount:asc", "id:asc"],
	},
	"replyCount:desc": {
		categories: ["posts"],
		requiresQuery: false,
		postgres: ["ranking.replyCount:desc", "id:asc"],
	},
	"closesAt:asc": {
		categories: ["polls"],
		requiresQuery: false,
		postgres: ["filters.closesAt:asc", "id:asc"],
	},
	"closesAt:desc": {
		categories: ["polls"],
		requiresQuery: false,
		postgres: ["filters.closesAt:desc", "id:asc"],
	},
	"title:asc": {
		categories: [],
		requiresQuery: false,
		postgres: [],
	},
	"title:desc": {
		categories: [],
		requiresQuery: false,
		postgres: [],
	},
	"progressLastSeenAt:asc": {
		categories: [],
		requiresQuery: false,
		postgres: [],
	},
	"progressLastSeenAt:desc": {
		categories: [],
		requiresQuery: false,
		postgres: [],
	},
} as const satisfies Readonly<Record<SearchSort, SearchSortDefinition>>;

const UuidPattern =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

/** Returns the complete server-owned capability definition for a public Search field. */
export function getCurrentSearchFieldDefinition(field: SearchField): SearchFieldDefinition {
	return CurrentSearchFieldRegistry[field];
}

/** Tests category applicability without duplicating the registry's capability matrix. */
export function supportsCurrentSearchField(category: SearchCategory, field: SearchField): boolean {
	return (CurrentSearchFieldRegistry[field].categories as readonly SearchCategory[]).includes(
		category,
	);
}

/** Tests whether a sort is part of a category's server-owned query contract. */
export function supportsCurrentSearchSort(category: SearchCategory, sort: SearchSort): boolean {
	return (CurrentSearchSortRegistry[sort].categories as readonly SearchCategory[]).includes(
		category,
	);
}

/**
 * Resolves and validates a sort before an engine adapter consumes its binding.
 *
 * @internal
 */
export function resolveCurrentSearchSortDefinition(
	category: SearchCategory,
	sort: SearchSort,
	query: string,
): SearchSortDefinition {
	const definition = CurrentSearchSortRegistry[sort];
	if (!(definition.categories as readonly SearchCategory[]).includes(category))
		throw new InvalidSearch(`${sort} is not supported by the ${category} category`);
	if (definition.requiresQuery && !query.trim())
		throw new InvalidSearch(`${sort} requires a text query`);
	return definition;
}

export function searchFilterValues(filter: SearchControlPredicate): readonly SearchScalar[] {
	if (filter.field === "realm-tag-vote") return [];
	if ("values" in filter) return filter.values;
	if ("value" in filter) return [filter.value];
	return [filter.lower, filter.upper].filter(
		(value): value is SearchScalar => value !== undefined,
	);
}

function assertScalar(field: SearchField, scalar: SearchScalarKind, value: SearchScalar): void {
	const valid =
		scalar === "boolean"
			? typeof value === "boolean"
			: scalar === "integer"
				? typeof value === "number" && Number.isSafeInteger(value)
				: scalar === "uuid"
					? typeof value === "string" && UuidPattern.test(value)
					: scalar === "date"
						? typeof value === "string" && Number.isFinite(Date.parse(value))
						: scalar === "string"
							? typeof value === "string" && value.length > 0 && value.length <= 500
							: false;
	if (!valid) throw new InvalidSearch(`Search field ${field} has an invalid ${scalar} value`);
}

/** Proves one scalar against the field's server-owned value contract. */
export function assertCurrentSearchFieldScalar(field: SearchField, value: SearchScalar): void {
	assertScalar(field, getCurrentSearchFieldDefinition(field).scalar, value);
}

function assertRealmTagVoteFilter(
	filter: Extract<SearchControlPredicate, { readonly field: "realm-tag-vote" }>,
): void {
	if (!UuidPattern.test(filter.realmId) || !UuidPattern.test(filter.tagId))
		throw new InvalidSearch("Realm Tag vote requires UUID Realm and Tag values");
	for (const [name, range] of [
		["score", filter.score],
		["voteCount", filter.voteCount],
	] as const) {
		if (
			(range?.lower !== undefined && !Number.isSafeInteger(range.lower)) ||
			(range?.upper !== undefined && !Number.isSafeInteger(range.upper))
		)
			throw new InvalidSearch(`Realm Tag vote ${name} requires safe integer bounds`);
		if (
			name === "voteCount" &&
			((range?.lower !== undefined && range.lower < 0) ||
				(range?.upper !== undefined && range.upper < 0))
		)
			throw new InvalidSearch("Realm Tag vote voteCount requires non-negative bounds");
		if (range?.lower !== undefined && range.upper !== undefined && range.lower > range.upper)
			throw new InvalidSearch(`Realm Tag vote ${name} lower bound exceeds its upper bound`);
	}
}

/**
 * Proves the operator and scalar-value semantics shared by every Search
 * surface and engine adapter.
 *
 * @internal
 */
export function assertCurrentSearchFilterValue(filter: SearchControlPredicate): void {
	const definition = getCurrentSearchFieldDefinition(filter.field);
	if (!(definition.operators as readonly SearchOperator[]).includes(filter.operator))
		throw new InvalidSearch(`${filter.operator} is not supported for ${filter.field}`);
	if (filter.field === "realm-tag-vote") {
		assertRealmTagVoteFilter(filter);
		return;
	}
	if (filter.operator === "exists") {
		const value: unknown = filter.value;
		if (typeof value !== "boolean")
			throw new InvalidSearch(`${filter.field} exists requires a boolean value`);
		return;
	}
	for (const value of searchFilterValues(filter))
		assertScalar(filter.field, definition.scalar, value);
	if (filter.operator === "range" && filter.lower !== undefined && filter.upper !== undefined) {
		const lower =
			definition.scalar === "date" && typeof filter.lower === "string"
				? Date.parse(filter.lower)
				: filter.lower;
		const upper =
			definition.scalar === "date" && typeof filter.upper === "string"
				? Date.parse(filter.upper)
				: filter.upper;
		if (typeof lower === "number" && typeof upper === "number" && lower > upper)
			throw new InvalidSearch(`${filter.field} lower bound exceeds its upper bound`);
	}
}

/**
 * Proves that a predicate is supported by the public field contract before an
 * engine adapter compiles it.
 *
 * @internal
 */
export function resolveCurrentSearchFilterDefinition(
	category: SearchCategory,
	filter: SearchControlPredicate,
): SearchFieldDefinition {
	const definition = getCurrentSearchFieldDefinition(filter.field);
	if (!(definition.categories as readonly SearchCategory[]).includes(category))
		throw new InvalidSearch(`${filter.field} is not supported by the ${category} category`);
	assertCurrentSearchFilterValue(filter);
	return definition;
}

export const HistorySearchFieldRegistry = {
	"unit-id": { documentPath: "unitId", scalar: "uuid", operators: equality },
	"unit-type": { documentPath: "unitType", scalar: "string", operators: equality },
	"actor-profile-id": {
		documentPath: "filters.actorProfileId",
		scalar: "uuid",
		operators: [...equality, "exists"],
	},
	minor: {
		documentPath: "filters.minor",
		scalar: "boolean",
		operators: ["equals", "not-equals"],
	},
	"change-tag": { documentPath: "filters.tags", scalar: "string", operators: equality },
	"created-at": { documentPath: "filters.createdAt", scalar: "date", operators: range },
} as const;
