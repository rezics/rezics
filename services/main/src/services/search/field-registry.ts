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
	"boolean" | "date" | "integer" | "string" | "uuid" | "realm-tag-vote";
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
	readonly meilisearch: readonly ("equality" | "comparison")[];
	readonly residual: boolean;
	readonly applicabilityPath?: string;
}

export interface SearchSortDefinition {
	readonly categories: readonly SearchCategory[];
	readonly requiresQuery: boolean;
	readonly meilisearch: readonly string[];
}

const allCategories: readonly SearchCategory[] = [
	"units",
	"users",
	"entity",
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
		meilisearch: ["equality"],
		residual: false,
	},
	kind: {
		categories: ["units", "entity", "posts", "reviews"],
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "searchKind",
		meilisearch: ["equality"],
		residual: false,
	},
	language: {
		categories: allCategories,
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "languages",
		meilisearch: ["equality"],
		residual: false,
	},
	"content-rating": {
		categories: allCategories,
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "filters.contentRating",
		meilisearch: ["equality"],
		residual: false,
	},
	"ai-disclosure": {
		categories: allCategories,
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "filters.aiDisclosure",
		meilisearch: ["equality"],
		residual: false,
	},
	license: {
		categories: allCategories,
		scalar: "string",
		operators: [...equality, "exists"],
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.license",
		meilisearch: ["equality"],
		residual: false,
	},
	tag: {
		categories: allCategories,
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.tagIds",
		meilisearch: ["equality"],
		residual: false,
	},
	credit: {
		categories: allCategories,
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.creditedUnitIds",
		meilisearch: ["equality"],
		residual: false,
	},
	"publisher-profile": {
		categories: ["units", "entity", "posts", "collections", "reviews"],
		scalar: "uuid",
		operators: equality,
		facet: "none",
		sort: "none",
		documentPath: "filters.publisherProfileIds",
		meilisearch: ["equality"],
		residual: true,
	},
	realm: {
		categories: allCategories,
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.realmIds",
		meilisearch: ["equality"],
		residual: false,
	},
	"realm-tag-vote": {
		categories: allCategories,
		scalar: "realm-tag-vote",
		operators: ["matches"],
		facet: "none",
		sort: "none",
		documentPath: "filters.realmTagVoteKeys",
		meilisearch: ["equality"],
		residual: true,
	},
	zone: {
		categories: allCategories,
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.scopeOwnerIds",
		meilisearch: [],
		residual: true,
	},
	subject: {
		categories: ["posts"],
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.subjectId",
		meilisearch: ["equality"],
		residual: false,
	},
	target: {
		categories: ["reviews"],
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.subjectId",
		meilisearch: ["equality"],
		residual: false,
	},
	root: {
		categories: ["posts"],
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.rootId",
		meilisearch: ["equality"],
		residual: false,
	},
	parent: {
		categories: ["posts"],
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.parentId",
		meilisearch: ["equality"],
		residual: false,
	},
	owner: {
		categories: ["units", "entity", "realms", "collections"],
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.ownerProfileIds",
		meilisearch: ["equality"],
		residual: false,
	},
	"join-policy": {
		categories: ["realms"],
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "filters.joinPolicy",
		meilisearch: ["equality"],
		residual: false,
	},
	multiple: {
		categories: ["polls"],
		scalar: "boolean",
		operators: ["equals", "not-equals"],
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "filters.pollMode",
		meilisearch: [],
		residual: true,
	},
	"results-visibility": {
		categories: ["polls"],
		scalar: "string",
		operators: equality,
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "filters.resultsVisibility",
		meilisearch: ["equality"],
		residual: false,
	},
	closed: {
		categories: ["polls"],
		scalar: "boolean",
		operators: ["equals", "not-equals"],
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "filters.closesAt",
		meilisearch: [],
		residual: true,
	},
	"created-at": {
		categories: allCategories,
		scalar: "date",
		operators: range,
		facet: "none",
		sort: "meili",
		documentPath: "ranking.createdAt",
		meilisearch: ["comparison"],
		residual: false,
	},
	"updated-at": {
		categories: allCategories,
		scalar: "date",
		operators: range,
		facet: "none",
		sort: "meili",
		documentPath: "ranking.updatedAt",
		meilisearch: ["comparison"],
		residual: false,
	},
	"published-at": {
		categories: allCategories,
		scalar: "date",
		operators: range,
		facet: "none",
		sort: "meili",
		documentPath: "ranking.publishedAt",
		meilisearch: ["comparison"],
		residual: false,
	},
	"closes-at": {
		categories: ["polls"],
		scalar: "date",
		operators: range,
		facet: "none",
		sort: "meili",
		documentPath: "filters.closesAt",
		meilisearch: ["comparison"],
		residual: false,
	},
	"catalog-licensed": {
		categories: ["units"],
		unitTypes: ["book", "media", "software"],
		scalar: "boolean",
		operators: ["equals", "not-equals"],
		facet: "meili-low-cardinality",
		sort: "none",
		documentPath: "catalog.licensed",
		meilisearch: ["equality"],
		residual: false,
		applicabilityPath: "unitType",
	},
	"catalog-release-date": {
		categories: ["units"],
		unitTypes: ["media", "software"],
		scalar: "date",
		operators: range,
		facet: "none",
		sort: "meili",
		documentPath: "catalog.releaseAt",
		meilisearch: ["comparison"],
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
		meilisearch: ["equality"],
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
		meilisearch: ["comparison"],
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
		meilisearch: ["comparison"],
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
		meilisearch: [],
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
		meilisearch: ["equality"],
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
		meilisearch: ["equality"],
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
		meilisearch: ["comparison"],
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
		meilisearch: ["comparison"],
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
		meilisearch: ["comparison"],
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
		meilisearch: ["comparison"],
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
		meilisearch: ["comparison"],
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
		meilisearch: ["equality"],
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
		meilisearch: ["equality"],
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
		meilisearch: ["equality"],
		residual: true,
		applicabilityPath: "unitType",
	},
} as const satisfies Readonly<Record<SearchField, SearchFieldDefinition>>;

export const CurrentSearchSortRegistry = {
	best: {
		categories: SearchCategoryValues,
		requiresQuery: false,
		meilisearch: ["ranking.recommendationBest:desc", "ranking.updatedAt:desc", "id:asc"],
	},
	relevance: {
		categories: SearchCategoryValues,
		requiresQuery: true,
		meilisearch: [],
	},
	"createdAt:asc": {
		categories: SearchCategoryValues,
		requiresQuery: false,
		meilisearch: ["ranking.createdAt:asc", "id:asc"],
	},
	"createdAt:desc": {
		categories: SearchCategoryValues,
		requiresQuery: false,
		meilisearch: ["ranking.createdAt:desc", "id:asc"],
	},
	"updatedAt:asc": {
		categories: SearchCategoryValues,
		requiresQuery: false,
		meilisearch: ["ranking.updatedAt:asc", "id:asc"],
	},
	"updatedAt:desc": {
		categories: SearchCategoryValues,
		requiresQuery: false,
		meilisearch: ["ranking.updatedAt:desc", "id:asc"],
	},
	"publishedAt:asc": {
		categories: ["units"],
		requiresQuery: false,
		meilisearch: ["ranking.publishedAt:asc", "id:asc"],
	},
	"publishedAt:desc": {
		categories: ["units"],
		requiresQuery: false,
		meilisearch: ["ranking.publishedAt:desc", "id:asc"],
	},
	"followerCount:asc": {
		categories: ["users", "realms"],
		requiresQuery: false,
		meilisearch: ["ranking.followerCount:asc", "id:asc"],
	},
	"followerCount:desc": {
		categories: ["users", "realms"],
		requiresQuery: false,
		meilisearch: ["ranking.followerCount:desc", "id:asc"],
	},
	"replyCount:asc": {
		categories: ["posts"],
		requiresQuery: false,
		meilisearch: ["ranking.replyCount:asc", "id:asc"],
	},
	"replyCount:desc": {
		categories: ["posts"],
		requiresQuery: false,
		meilisearch: ["ranking.replyCount:desc", "id:asc"],
	},
	"closesAt:asc": {
		categories: ["polls"],
		requiresQuery: false,
		meilisearch: ["filters.closesAt:asc", "id:asc"],
	},
	"closesAt:desc": {
		categories: ["polls"],
		requiresQuery: false,
		meilisearch: ["filters.closesAt:desc", "id:asc"],
	},
	"title:asc": {
		categories: [],
		requiresQuery: false,
		meilisearch: [],
	},
	"title:desc": {
		categories: [],
		requiresQuery: false,
		meilisearch: [],
	},
	"progressLastSeenAt:asc": {
		categories: [],
		requiresQuery: false,
		meilisearch: [],
	},
	"progressLastSeenAt:desc": {
		categories: [],
		requiresQuery: false,
		meilisearch: [],
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
