import { UnitOwnerValues, PlatformOwnerValues } from "@rezics/reference";
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
	readonly candidateSource: "btree" | "sparse-btree" | "pgroonga" | null;
	readonly orderingIndexes: readonly string[];
}

const allCategories: readonly SearchCategory[] = [
	"units",
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
	"unit-owner": { categories: allCategories, scalar: "string", operators: equality, facet: "meili-low-cardinality", sort: "none", documentPath: "owner", postgres: ["equality"], residual: false },
	"unit-shape": { categories: allCategories, scalar: "string", operators: equality, facet: "meili-low-cardinality", sort: "none", documentPath: "shape", postgres: ["equality"], residual: false },
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
	collection: {
		categories: allCategories,
		scalar: "uuid",
		operators: equality,
		facet: "none",
		sort: "none",
		documentPath: "filters.collectionIds",
		postgres: ["equality"],
		residual: false,
	},
	credit: {
		categories: allCategories,
		scalar: "uuid",
		operators: equality,
		facet: "postgres-authorized",
		sort: "none",
		documentPath: "filters.creditedEntityIds",
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
		documentPath: "filters.realmTagJudgmentKeys",
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

} as const satisfies Readonly<Record<SearchField, SearchFieldDefinition>>;

export const CurrentSearchSortRegistry = {
	best: {
		categories: SearchCategoryValues,
		requiresQuery: false,
		postgres: ["ranking.recommendationBest:desc", "ranking.updatedAt:desc", "id:desc"],
		candidateSource: "sparse-btree",
		orderingIndexes: [
			"unit_best_score_order_idx",
			"unit_best_score_owner_order_idx",
			"unit_best_score_owner_shape_order_idx",
			...UnitOwnerValues.map(owner=>`${owner}_identity_public_updated_idx`),
		],
	},
	relevance: {
		categories: SearchCategoryValues,
		requiresQuery: true,
		postgres: [],
		candidateSource: "pgroonga",
		orderingIndexes: [
			"unit_localization_pgroonga_metadata_idx",
			"unit_localization_pgroonga_content_idx",
			"unit_search_document_pgroonga_idx",
			...UnitOwnerValues.filter(owner=>!PlatformOwnerValues.some(platform=>platform===owner)).map(owner=>`${owner}_named_form_search_idx`),
		],
	},
	"createdAt:asc": {
		categories: SearchCategoryValues,
		requiresQuery: false,
		postgres: ["ranking.createdAt:asc", "id:asc"],
		candidateSource: "btree",
		orderingIndexes: UnitOwnerValues.map(owner=>`${owner}_identity_public_created_idx`),
	},
	"createdAt:desc": {
		categories: SearchCategoryValues,
		requiresQuery: false,
		postgres: ["ranking.createdAt:desc", "id:desc"],
		candidateSource: "btree",
		orderingIndexes: UnitOwnerValues.map(owner=>`${owner}_identity_public_created_idx`),
	},
	"updatedAt:asc": {
		categories: SearchCategoryValues,
		requiresQuery: false,
		postgres: ["ranking.updatedAt:asc", "id:asc"],
		candidateSource: "btree",
		orderingIndexes: UnitOwnerValues.map(owner=>`${owner}_identity_public_updated_idx`),
	},
	"updatedAt:desc": {
		categories: SearchCategoryValues,
		requiresQuery: false,
		postgres: ["ranking.updatedAt:desc", "id:desc"],
		candidateSource: "btree",
		orderingIndexes: UnitOwnerValues.map(owner=>`${owner}_identity_public_updated_idx`),
	},
	"publishedAt:asc": {
		categories: ["units"],
		requiresQuery: false,
		postgres: ["ranking.publishedAt:asc", "id:asc"],
		candidateSource: "btree",
		orderingIndexes: PlatformOwnerValues.map(owner=>`${owner}_identity_public_published_idx`),
	},
	"publishedAt:desc": {
		categories: ["units"],
		requiresQuery: false,
		postgres: ["ranking.publishedAt:desc", "id:desc"],
		candidateSource: "btree",
		orderingIndexes: PlatformOwnerValues.map(owner=>`${owner}_identity_public_published_idx`),
	},
	"followerCount:asc": {
		categories: ["realms"],
		requiresQuery: false,
		postgres: ["ranking.followerCount:asc", "id:asc"],
		candidateSource: "sparse-btree",
		orderingIndexes: ["unit_follow_stat_count_asc_idx", "realm_pkey"],
	},
	"followerCount:desc": {
		categories: ["realms"],
		requiresQuery: false,
		postgres: ["ranking.followerCount:desc", "id:desc"],
		candidateSource: "sparse-btree",
		orderingIndexes: ["unit_follow_stat_count_desc_idx", "realm_pkey"],
	},
	"replyCount:asc": {
		categories: ["posts"],
		requiresQuery: false,
		postgres: ["ranking.replyCount:asc", "id:asc"],
		candidateSource: "btree",
		orderingIndexes: ["post_reply_stat_search_count_asc_idx"],
	},
	"replyCount:desc": {
		categories: ["posts"],
		requiresQuery: false,
		postgres: ["ranking.replyCount:desc", "id:desc"],
		candidateSource: "btree",
		orderingIndexes: ["post_reply_stat_search_count_desc_idx"],
	},
	"closesAt:asc": {
		categories: ["polls"],
		requiresQuery: false,
		postgres: ["filters.closesAt:asc", "id:asc"],
		candidateSource: "btree",
		orderingIndexes: ["poll_closes_at_asc_idx"],
	},
	"closesAt:desc": {
		categories: ["polls"],
		requiresQuery: false,
		postgres: ["filters.closesAt:desc", "id:desc"],
		candidateSource: "btree",
		orderingIndexes: ["poll_closes_at_desc_idx"],
	},
	"title:asc": {
		categories: [],
		requiresQuery: false,
		postgres: [],
		candidateSource: null,
		orderingIndexes: [],
	},
	"title:desc": {
		categories: [],
		requiresQuery: false,
		postgres: [],
		candidateSource: null,
		orderingIndexes: [],
	},
	"progressLastSeenAt:asc": {
		categories: [],
		requiresQuery: false,
		postgres: [],
		candidateSource: null,
		orderingIndexes: [],
	},
	"progressLastSeenAt:desc": {
		categories: [],
		requiresQuery: false,
		postgres: [],
		candidateSource: null,
		orderingIndexes: [],
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
	return [filter.lower, filter.upper].filter((value): value is SearchScalar => value !== undefined);
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
