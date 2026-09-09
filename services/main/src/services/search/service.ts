import { CatalogOwnerValues, UnitOwnerValues, type UnitOwner } from "@rezics/reference";
import { unitOwnerTable } from "../database/schema/unit-reference-columns";
import { unitStateRelation } from "../units/state-relation";
import { ContentLanguageRegistryPolicy } from "@rezics/content-language";
import { createHash } from "node:crypto";

import {
	canonicalUnitPredicate,
	readUnitLanguageBoundary,
	SearchFieldValues,
	type SearchControlPredicate,
	type SearchField,
	type SearchScalar,
	type SearchScalarField,
} from "@rezics/filter";
import { isContentLanguage, type ContentLanguage } from "@rezics/i18n";
import { isLicenseId } from "@rezics/license";
import { getActiveObservability } from "@rezics/observability";
import { and, eq, exists, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getUnitReadCondition } from "../authorization/unit/query";
import { env } from "../config";
import {
	contentRatingPolicyKey,
	DefaultContentRatingPolicy,
	getContentRatingCondition,
} from "../content-rating/policy";
import type { SearchCountResult } from "../counts/contract";
import { database } from "../database";
import {
	collection,
	collectionItem,
	contentStructure,
	contentStructureNode,
	creditAttribution,
	poll,
	post,
	PostKindValues,
	postReply,
	postReplyStat,
	realm,
	realmTagContext,
	realmTagJudgmentStat,
	realmUnit,
	recommendationSnapshot,
	tagPublicPositionStat,
	unitBestScore,
	unitEffectiveTag,
	unitFollowStat,
	unitLicenseGrant,
	unitLocalization,
	unitOwnership,
	unitSearchDocument,
} from "../database/schema";
import { compileUnitPredicateCandidateSet, compileUnitPredicateSql } from "../filter/sql";
import { WorkPolicy } from "../performance/policy";
import { readUnitPresentationsInTransaction } from "../units/presentation-reader";
import { getPublicCanonicalUnitSlugAddresses } from "../units/slug-address";
import { CurrentSearchOwnersByCategory } from "./contracts";
import { InvalidSearch } from "./errors";
import {
	getCurrentSearchFieldDefinition,
	resolveCurrentSearchFilterDefinition,
	resolveCurrentSearchSortDefinition,
	searchFilterValues,
	supportsCurrentSearchField,
} from "./field-registry";
import {
	assertSearchExpression,
	combineSearchExpressions,
	createSearchCursor,
	parseSearchCursor,
	readSearchExpressionLanguageBoundary,
	SearchCursorVersion,
	type GroupedSearchCursorToken,
	type SearchExpression,
	type SearchKeysetPosition,
} from "./query";
import { expandSearchQuery, type ExpandedSearchQuery } from "./query-expansion";
import {
	SearchFieldByDomainRequestFilter,
	type DomainSearchRequest,
	type SearchCategory,
	type SearchHit,
	type SearchSort,
} from "./schema";
import { boundedSearchStatementTimeout } from "./statement-timeout";

// Columns are bound to one concrete owner scan or an explicit bounded ID lookup.
const searchUnit = unitStateRelation(sql`null::uuid`, "search_unit");
function searchState(id: SQL): SQL {
	return sql`lateral ${unitStateRelation(id, "search_unit")}`;
}
function ownerSearchRelation(owner: UnitOwner, shapes: readonly string[] = []): SQL {
	const table = unitOwnerTable(owner);
	const shape =
		owner === "post"
			? sql`${post.kind}::text`
			: "shape" in table
				? sql`${table.shape}`
				: sql`${owner}::text`;
	const publishedAt = "publishedAt" in table ? sql`${table.publishedAt}` : sql`null::timestamptz`;
	const requestedPostShapes = shapes.filter((value): value is (typeof PostKindValues)[number] =>
		PostKindValues.some((kind) => kind === value),
	);
	const shapeCondition = !shapes.length
		? sql`true`
		: owner === "post"
			? requestedPostShapes.length
				? inArray(post.kind, requestedPostShapes)
				: sql`false`
			: "shape" in table
				? inArray(table.shape, [...shapes])
				: sql`${shapes.includes(owner)}`;
	return sql`(select ${table.id} as id, ${owner}::text as owner, ${shape} as shape,
 ${table.status} as status, ${table.visibility} as visibility,
 ${table.moderationStatus} as moderation_status, ${table.deletedAt} as deleted_at,
 ${table.createdAt} as created_at, ${table.updatedAt} as updated_at, ${publishedAt} as published_at
 from ${table} where ${shapeCondition}) as search_unit`;
}
const searchFilterCollectionUnit = alias(collection, "search_filter_collection_unit");
const boundedSearchDocument = alias(unitSearchDocument, "bounded_search_document");
const facetUnitTag = alias(unitEffectiveTag, "facet_unit_tag");
const facetRealmUnit = alias(realmUnit, "facet_realm_unit");
const facetCreditAttribution = alias(creditAttribution, "facet_credit_attribution");
const facetOwnership = alias(unitOwnership, "facet_ownership");
const facetLicenseGrant = alias(unitLicenseGrant, "facet_license_grant");
const scopedRealmTagContextRealm = alias(realm, "scoped_realm_tag_context_realm");
const scopedRealmTagContextPostUnit = alias(post, "scoped_realm_tag_context_post_unit");
const scopedRealmTagContextRealmUnit = alias(realmUnit, "scoped_realm_tag_context_realm_unit");
const { metrics } = getActiveObservability();
type SearchHitWithoutSlugAddress = Omit<SearchHit, "slugAddress">;

function toTextArray(values: readonly string[]): SQL {
	return sql`ARRAY[${sql.join(
		values.map((value) => sql`${value}`),
		sql`, `,
	)}]::text[]`;
}

function toUuidArray(values: readonly string[]): SQL {
	if (
		values.some(
			(value) =>
				!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
					value,
				),
		)
	)
		throw new InvalidSearch("Search filter requires UUID values");
	return sql`ARRAY[${sql.join(
		values.map((value) => sql`${value}::uuid`),
		sql`, `,
	)}]::uuid[]`;
}

function validateRequest(category: SearchCategory, request: DomainSearchRequest): void {
	const filters = [
		["Languages", SearchFieldByDomainRequestFilter.Languages, Boolean(request.Languages?.length)],
		["owners", SearchFieldByDomainRequestFilter.owner, Boolean(request.owners?.length)],
		["shapes", SearchFieldByDomainRequestFilter.shape, Boolean(request.shapes?.length)],
		[
			"contentRatings",
			SearchFieldByDomainRequestFilter.contentRating,
			Boolean(request.contentRatings?.length),
		],
		[
			"aiDisclosures",
			SearchFieldByDomainRequestFilter.aiDisclosure,
			Boolean(request.aiDisclosures?.length),
		],
		["licenses", SearchFieldByDomainRequestFilter.license, Boolean(request.licenses?.length)],
		[
			"creditedEntityId",
			SearchFieldByDomainRequestFilter.creditedEntityId,
			Boolean(request.creditedEntityId),
		],
		["realmId", SearchFieldByDomainRequestFilter.realmId, Boolean(request.realmId)],
		[
			"realmTagContextRealmId",
			SearchFieldByDomainRequestFilter.realmTagContextRealmId,
			Boolean(request.realmTagContextRealmId),
		],
		["subjectId", SearchFieldByDomainRequestFilter.subjectId, Boolean(request.subjectId)],
		["targetId", SearchFieldByDomainRequestFilter.targetId, Boolean(request.targetId)],
		["rootId", SearchFieldByDomainRequestFilter.rootId, Boolean(request.rootId)],
		["parentId", SearchFieldByDomainRequestFilter.parentId, Boolean(request.parentId)],
		["ownerId", SearchFieldByDomainRequestFilter.ownerId, Boolean(request.ownerId)],
		[
			"joinPolicies",
			SearchFieldByDomainRequestFilter.joinPolicy,
			Boolean(request.joinPolicies?.length),
		],
		["multiple", SearchFieldByDomainRequestFilter.multiple, request.multiple !== undefined],
		[
			"resultsVisibilities",
			SearchFieldByDomainRequestFilter.resultsVisibility,
			Boolean(request.resultsVisibilities?.length),
		],
		["closed", SearchFieldByDomainRequestFilter.closesAt, request.closed !== undefined],
	] as const;
	for (const [key, field, present] of filters)
		if (present && !supportsCurrentSearchField(category, field))
			throw new InvalidSearch(`${key} is not supported by the ${category} category`);

	const sort = request.sort ?? (request.query?.trim() ? "relevance" : "best");
	resolveCurrentSearchSortDefinition(category, sort, request.query ?? "");
}

function scalarStrings(values: readonly SearchScalar[], field: string): string[] {
	const strings: string[] = [];
	for (const value of values) {
		if (typeof value !== "string") throw new InvalidSearch(`${field} requires string values`);
		strings.push(value);
	}
	return strings;
}

function collectionMembershipValues(
	filter: Extract<SearchControlPredicate, { readonly field: "collection" }>,
): readonly string[] {
	return [...new Set("value" in filter ? [filter.value] : filter.values)];
}

function collectionMembershipCondition(
	filter: Extract<SearchControlPredicate, { readonly field: "collection" }>,
): SQL {
	const collectionIds = collectionMembershipValues(filter);
	const matches =
		filter.operator === "all-of"
			? sql`(${sql.join(
					collectionIds.map(
						(collectionId) => sql`exists (
							select 1
							from ${collectionItem} search_collection_membership
							where search_collection_membership.unit_id = ${searchUnit.id}
								and search_collection_membership.collection_id = ${collectionId}::uuid
						)`,
					),
					sql` and `,
				)})`
			: sql`exists (
				select 1
				from ${collectionItem} search_collection_membership
				where search_collection_membership.unit_id = ${searchUnit.id}
					and search_collection_membership.collection_id = any(${toUuidArray(collectionIds)})
			)`;
	return filter.operator === "not-equals" || filter.operator === "none-of"
		? sql`not (${matches})`
		: matches;
}

function scalarColumnCondition(column: SQL, filter: SearchControlPredicate): SQL {
	if (filter.operator === "exists")
		return filter.value ? sql`${column} is not null` : sql`${column} is null`;
	if (filter.operator === "range") {
		if (filter.lower !== undefined && typeof filter.lower !== "string")
			throw new InvalidSearch("Date range lower bound must be an ISO date-time");
		if (filter.upper !== undefined && typeof filter.upper !== "string")
			throw new InvalidSearch("Date range upper bound must be an ISO date-time");
		const bounds: SQL[] = [];
		if (filter.lower !== undefined) bounds.push(sql`${column} >= ${filter.lower}::timestamptz`);
		if (filter.upper !== undefined) bounds.push(sql`${column} <= ${filter.upper}::timestamptz`);
		return sql`(${sql.join(bounds, sql` and `)})`;
	}
	const values = scalarStrings(searchFilterValues(filter), filter.field);
	if (filter.operator === "all-of" && values.length > 1)
		throw new InvalidSearch(`${filter.field} cannot equal multiple values`);
	const match = sql`(${column})::text = any(${toTextArray(values)})`;
	return filter.operator === "not-equals" || filter.operator === "none-of"
		? sql`not (${match})`
		: match;
}

function compileFilter(
	category: SearchCategory,
	filter: SearchControlPredicate,
	profileId?: string,
): SQL {
	resolveCurrentSearchFilterDefinition(category, filter);
	if (filter.field === "realm-tag-context") {
		if (!("value" in filter) || typeof filter.value !== "string")
			throw new InvalidSearch("realm-tag-context requires a Realm UUID");
		return sql`exists (
			select 1
			from ${realmTagContext}
			inner join ${realm} as ${scopedRealmTagContextRealm}
				on ${scopedRealmTagContextRealm.id} = ${realmTagContext.realmId}
			inner join ${realmUnit} as ${scopedRealmTagContextRealmUnit}
				on ${scopedRealmTagContextRealmUnit.realmId} = ${realmTagContext.realmId}
				and ${scopedRealmTagContextRealmUnit.unitId} = ${realmTagContext.contextPostId}
			inner join ${post} as ${scopedRealmTagContextPostUnit}
				on ${scopedRealmTagContextPostUnit.id} = ${realmTagContext.contextPostId}
			where ${realmTagContext.tagId} = ${searchUnit.id}
				and ${realmTagContext.realmId} = ${filter.value}::uuid
				and ${scopedRealmTagContextRealm.realmTagVotingEnabled} = true
				and ${scopedRealmTagContextRealmUnit.status} = 'visible'
				and ${scopedRealmTagContextRealmUnit.publicationState} = 'active'
				and ${getUnitReadCondition(profileId, {}, scopedRealmTagContextPostUnit)}
		)`;
	}
	if (filter.field === "realm-tag-vote") {
		const conditions: SQL[] = [
			sql`${realmTagJudgmentStat.unitId} = ${searchUnit.id}`,
			sql`${realmTagJudgmentStat.realmId} = ${filter.realmId}::uuid`,
			sql`${realmTagJudgmentStat.tagId} = ${filter.tagId}::uuid`,
			sql`${realmTagJudgmentStat.voteCount} > 0`,
		];
		const addBounds = (
			column: SQL,
			range: { readonly lower?: number; readonly upper?: number } | undefined,
		) => {
			if (range?.lower !== undefined) conditions.push(sql`${column} >= ${range.lower}`);
			if (range?.upper !== undefined) conditions.push(sql`${column} <= ${range.upper}`);
		};
		addBounds(sql`${realmTagJudgmentStat.score}`, filter.score);
		addBounds(sql`${realmTagJudgmentStat.voteCount}`, filter.voteCount);
		return sql`exists (
			select 1
			from ${realmTagJudgmentStat}
			where ${sql.join(conditions, sql` and `)}
		)`;
	}
	if (filter.field === "category") {
		const values = scalarStrings(searchFilterValues(filter), filter.field);
		const matches = values.includes(category);
		if (filter.operator === "not-equals" || filter.operator === "none-of") return sql`${!matches}`;
		return sql`${matches}`;
	}
	if (filter.field === "license") {
		const anyGrantedLicense = exists(
			database
				.select({ unitId: unitLicenseGrant.unitId })
				.from(unitLicenseGrant)
				.where(
					and(
						eq(unitLicenseGrant.unitId, searchUnit.id),
						isNull(unitLicenseGrant.offeringEndedAt),
						eq(unitLicenseGrant.recognitionStatus, "recognized"),
					),
				),
		);
		if (filter.operator === "exists")
			return filter.value ? anyGrantedLicense : sql`not ${anyGrantedLicense}`;
		const values = scalarStrings(searchFilterValues(filter), filter.field).filter(isLicenseId);
		const grantExists = exists(
			database
				.select({ unitId: unitLicenseGrant.unitId })
				.from(unitLicenseGrant)
				.where(
					and(
						eq(unitLicenseGrant.unitId, searchUnit.id),
						isNull(unitLicenseGrant.offeringEndedAt),
						eq(unitLicenseGrant.recognitionStatus, "recognized"),
						values.length > 0 ? inArray(unitLicenseGrant.licenseId, values) : undefined,
					),
				),
		);
		if (filter.operator === "not-equals" || filter.operator === "none-of")
			return sql`not ${grantExists}`;
		return grantExists;
	}
	if (filter.field === "language") {
		const values = scalarStrings(searchFilterValues(filter), filter.field);
		const localizedMatch =
			filter.operator === "all-of"
				? sql`array(
					select ${unitLocalization.language}
					from ${unitLocalization}
					where ${unitLocalization.unitId} = ${searchUnit.id}
				) @> ${toTextArray(values)}`
				: sql`exists (
					select 1 from ${unitLocalization}
					where ${unitLocalization.unitId} = ${searchUnit.id}
						and ${unitLocalization.language} = any(${toTextArray(values)})
				)`;
		const match = sql`(${localizedMatch} or public.catalog_name_has_languages(${searchUnit.id}, ${toTextArray(values)}, ${filter.operator === "all-of"}))`;
		return filter.operator === "not-equals" || filter.operator === "none-of"
			? sql`not (${match})`
			: match;
	}
	if (filter.field === "credit") {
		const creditedEntitys = sql`array(
			select distinct ${creditAttribution.creditedEntityId}
			from ${creditAttribution}
			where ${creditAttribution.sourceUnitId} = ${searchUnit.id}
		)`;
		if (filter.operator === "exists")
			return filter.value
				? sql`cardinality(${creditedEntitys}) > 0`
				: sql`cardinality(${creditedEntitys}) = 0`;
		const values = scalarStrings(searchFilterValues(filter), filter.field);
		const match =
			filter.operator === "all-of"
				? sql`${creditedEntitys} @> ${toUuidArray(values)}`
				: sql`${creditedEntitys} && ${toUuidArray(values)}`;
		return filter.operator === "not-equals" || filter.operator === "none-of"
			? sql`not (${match})`
			: match;
	}
	if (filter.field === "credited-profile") {
		const creditedProfiles = sql`array(select direct_credit.credited_entity_id
 from public.credit_attribution direct_credit
 join public.account_self on account_self.entity_id=direct_credit.credited_entity_id
 join public.entity_identity direct_profile on direct_profile.id=account_self.entity_id
 where direct_credit.source_unit_id=${searchUnit.id}
 and direct_profile.status='published' and direct_profile.visibility='public'
 and direct_profile.moderation_status='approved' and direct_profile.deleted_at is null)`;
		const values = scalarStrings(searchFilterValues(filter), filter.field);
		const match =
			filter.operator === "all-of"
				? sql`${creditedProfiles} @> ${toUuidArray(values)}`
				: sql`${creditedProfiles} && ${toUuidArray(values)}`;
		return filter.operator === "not-equals" || filter.operator === "none-of"
			? sql`not (${match})`
			: match;
	}
	if (filter.field === "zone") {
		const scopeOwners = sql`array(
			select distinct ${contentStructureNode.ownerUnitId}
			from ${contentStructureNode}
			join ${contentStructure}
				on ${contentStructure.id} = ${contentStructureNode.structureId}
			where ${contentStructureNode.contentUnitId} = ${searchUnit.id}
				and ${contentStructureNode.deletedAt} is null
				and ${contentStructure.deletedAt} is null
				and ${contentStructure.kind} in ('book.contents', 'post.contents')
		)`;
		const values = scalarStrings(searchFilterValues(filter), filter.field);
		const match =
			filter.operator === "all-of"
				? sql`${scopeOwners} @> ${toUuidArray(values)}`
				: sql`${scopeOwners} && ${toUuidArray(values)}`;
		return filter.operator === "not-equals" || filter.operator === "none-of"
			? sql`not (${match})`
			: match;
	}
	if (filter.field === "owner") {
		const owners = sql`array(
			select distinct ${unitOwnership.profileId}
			from ${unitOwnership}
			where ${unitOwnership.unitId} = ${searchUnit.id}
				and ${unitOwnership.revokedAt} is null
		)`;
		if (filter.operator === "exists")
			return filter.value ? sql`cardinality(${owners}) > 0` : sql`cardinality(${owners}) = 0`;
		const values = scalarStrings(searchFilterValues(filter), filter.field);
		const match =
			filter.operator === "all-of"
				? sql`${owners} @> ${toUuidArray(values)}`
				: sql`${owners} && ${toUuidArray(values)}`;
		return filter.operator === "not-equals" || filter.operator === "none-of"
			? sql`not (${match})`
			: match;
	}
	if (filter.field === "tag") {
		const values = scalarStrings(searchFilterValues(filter), filter.field);
		const match =
			filter.operator === "all-of"
				? sql`array(
					select ${unitEffectiveTag.tagId} from ${unitEffectiveTag}
					where ${unitEffectiveTag.unitId} = ${searchUnit.id}
				) @> ${toUuidArray(values)}`
				: sql`exists (
					select 1 from ${unitEffectiveTag}
					where ${unitEffectiveTag.unitId} = ${searchUnit.id}
						and ${unitEffectiveTag.tagId} = any(${toUuidArray(values)})
				)`;
		return filter.operator === "not-equals" || filter.operator === "none-of"
			? sql`not (${match})`
			: match;
	}
	if (filter.field === "collection") return collectionMembershipCondition(filter);
	if (filter.field === "realm") {
		const values = scalarStrings(searchFilterValues(filter), filter.field);
		const match =
			filter.operator === "all-of"
				? sql`array(
					select ${realmUnit.realmId}
					from ${realmUnit}
					where ${realmUnit.unitId} = ${searchUnit.id}
						and ${realmUnit.status} = 'visible'
						and ${realmUnit.publicationState} = 'active'
				) @> ${toUuidArray(values)}`
				: sql`exists (
					select 1 from ${realmUnit}
					where ${realmUnit.unitId} = ${searchUnit.id}
						and ${realmUnit.realmId} = any(${toUuidArray(values)})
						and ${realmUnit.status} = 'visible'
						and ${realmUnit.publicationState} = 'active'
				)`;
		return filter.operator === "not-equals" || filter.operator === "none-of"
			? sql`not (${match})`
			: match;
	}
	if (filter.field === "multiple" || filter.field === "closed") {
		if (!("value" in filter) || typeof filter.value !== "boolean")
			throw new InvalidSearch(`${filter.field} requires an equals boolean filter`);
		const match =
			filter.field === "multiple"
				? sql`(${poll.mode} = 'multiple') = ${filter.value}`
				: filter.value
					? sql`(${poll.closedAt} is not null or ${poll.closesAt} <= now())`
					: sql`(${poll.closedAt} is null and (${poll.closesAt} is null or ${poll.closesAt} > now()))`;
		const condition = filter.operator === "not-equals" ? sql`not (${match})` : match;
		return sql`exists (
			select 1 from ${poll}
			where ${poll.id} = ${searchUnit.id} and ${condition}
		)`;
	}

	if (filter.field === "unit-owner") return scalarColumnCondition(sql`${searchUnit.owner}`, filter);
	if (filter.field === "unit-shape") return scalarColumnCondition(sql`${searchUnit.shape}`, filter);

	const directUnitColumnByField: Partial<Record<SearchControlPredicate["field"], SQL>> = {
		"content-rating": sql`${searchUnit.contentRating}`,
		"ai-disclosure": sql`${searchUnit.aiDisclosure}`,
		"created-at": sql`${searchUnit.createdAt}`,
		"updated-at": sql`${searchUnit.updatedAt}`,
		"published-at": sql`${searchUnit.publishedAt}`,
	};
	const directUnitColumn = directUnitColumnByField[filter.field];
	if (directUnitColumn) return scalarColumnCondition(directUnitColumn, filter);

	const oneToOneColumnByField: Partial<
		Record<
			SearchControlPredicate["field"],
			{ readonly relation: SQL; readonly id: SQL; readonly column: SQL }
		>
	> = {
		subject: {
			relation: sql`${post}`,
			id: sql`${post.id}`,
			column: sql`${post.subjectUnitId}`,
		},
		target: { relation: sql`${post}`, id: sql`${post.id}`, column: sql`${post.subjectUnitId}` },
		root: {
			relation: sql`${postReply}`,
			id: sql`${postReply.postId}`,
			column: sql`${postReply.rootPostId}`,
		},
		parent: {
			relation: sql`${postReply}`,
			id: sql`${postReply.postId}`,
			column: sql`${postReply.parentPostId}`,
		},
		"join-policy": {
			relation: sql`${realm}`,
			id: sql`${realm.id}`,
			column: sql`${realm.joinPolicy}`,
		},
		"results-visibility": {
			relation: sql`${poll}`,
			id: sql`${poll.id}`,
			column: sql`${poll.resultVisibility}`,
		},
		"closes-at": {
			relation: sql`${poll}`,
			id: sql`${poll.id}`,
			column: sql`${poll.closesAt}`,
		},
	};
	const oneToOneColumn = oneToOneColumnByField[filter.field];
	if (!oneToOneColumn) throw new InvalidSearch(`${filter.field} is not implemented`);
	return sql`exists (
		select 1 from ${oneToOneColumn.relation}
		where ${oneToOneColumn.id} = ${searchUnit.id}
			and ${scalarColumnCondition(oneToOneColumn.column, filter)}
	)`;
}

/**
 * Compiles a proven engine-independent Search expression into the
 * authoritative PostgreSQL predicate.
 *
 * @internal
 */
export function compilePostgresSearchExpression(
	category: SearchCategory,
	expression: SearchExpression,
	profileId?: string,
): SQL {
	if ("field" in expression) return compileFilter(category, expression, profileId);
	if (expression.operator === "not")
		return sql`not (${compilePostgresSearchExpression(category, expression.clause, profileId)})`;

	const clauses = expression.clauses.map((clause) =>
		compilePostgresSearchExpression(category, clause, profileId),
	);
	return sql`(${sql.join(clauses, expression.operator === "all" ? sql` and ` : sql` or `)})`;
}

function collectionSearchCandidateSet(
	filter: Extract<SearchControlPredicate, { readonly field: "collection" }>,
): SQL | undefined {
	if (filter.operator === "not-equals" || filter.operator === "none-of") return undefined;
	const collectionIds = collectionMembershipValues(filter);
	return combineCandidateSets(
		filter.operator === "all-of" ? "intersect" : "union",
		collectionIds.map(
			(collectionId) => sql`select search_collection_seed.unit_id
				from ${collectionItem} search_collection_seed
				where search_collection_seed.collection_id = ${collectionId}::uuid`,
		),
	);
}

function combineCandidateSets(
	operator: "intersect" | "union",
	sets: readonly SQL[],
): SQL | undefined {
	if (!sets.length) return undefined;
	if (sets.length === 1) return sets[0];
	return sql`${sql.join(
		sets.map((candidate) => sql`(${candidate})`),
		operator === "intersect" ? sql` intersect ` : sql` union `,
	)}`;
}

/**
 * Produces a safe candidate superset for collection predicates.
 *
 * Conjunctions can use any bounded child. Disjunctions can be seeded only
 * when every branch has a candidate set; negation cannot seed a corpus query.
 */
function compileSearchExpressionCandidateSet(expression: SearchExpression): SQL | undefined {
	if ("field" in expression)
		return expression.field === "collection" ? collectionSearchCandidateSet(expression) : undefined;
	if (expression.operator === "not") return undefined;
	const candidates = expression.clauses.map(compileSearchExpressionCandidateSet);
	if (expression.operator === "any") {
		if (candidates.some((candidate) => candidate === undefined)) return undefined;
		return combineCandidateSets("union", candidates as SQL[]);
	}
	return combineCandidateSets(
		"intersect",
		candidates.filter((candidate): candidate is SQL => candidate !== undefined),
	);
}

function hasCollectionCandidateSet(expression: SearchExpression | undefined): boolean {
	return expression !== undefined && compileSearchExpressionCandidateSet(expression) !== undefined;
}

function searchCollectionIds(expression: SearchExpression | undefined): string[] {
	if (!expression) return [];
	if ("field" in expression)
		return expression.field === "collection" ? [...collectionMembershipValues(expression)] : [];
	return expression.operator === "not"
		? searchCollectionIds(expression.clause)
		: expression.clauses.flatMap(searchCollectionIds);
}

async function authorizeSearchCollections(
	expression: SearchExpression | undefined,
	profileId?: string,
): Promise<void> {
	const collectionIds = [...new Set(searchCollectionIds(expression))];
	if (!collectionIds.length) return;
	const readable = await database
		.select({ id: collection.id })
		.from(collection)
		.innerJoin(searchFilterCollectionUnit, eq(searchFilterCollectionUnit.id, collection.id))
		.where(
			and(
				inArray(collection.id, collectionIds),
				getUnitReadCondition(profileId, {}, searchFilterCollectionUnit),
			),
		);
	if (new Set(readable.map(({ id }) => id)).size !== collectionIds.length)
		throw new InvalidSearch("A referenced Search Collection is unavailable");
}

function searchCandidateSet(
	expression: SearchExpression | undefined,
	domainFilter: DomainSearchRequest["domainFilter"],
	profileId?: string,
): SQL | undefined {
	return combineCandidateSets(
		"intersect",
		[
			expression ? compileSearchExpressionCandidateSet(expression) : undefined,
			domainFilter ? compileUnitPredicateCandidateSet(domainFilter, profileId) : undefined,
		].filter((candidate): candidate is SQL => candidate !== undefined),
	);
}

function buildCommonSearchConditions(request: DomainSearchRequest): SQL[] {
	const readCondition = getUnitReadCondition(
		request.profileId,
		{ discoverableOnly: true },
		searchUnit,
	);
	if (!readCondition) throw new Error("Unit read policy produced no SQL condition");
	const conditions: SQL[] = [readCondition];
	conditions.push(
		getContentRatingCondition(
			request.contentRatingPolicy ?? DefaultContentRatingPolicy,
			searchUnit.contentRating,
		),
	);
	if (request.scopeUnitId) {
		const direct = sql`${searchUnit.id} = ${request.scopeUnitId}::uuid`;
		conditions.push(
			request.includeScopeDescendants
				? sql`(${direct} or exists (
					select 1
					from ${contentStructureNode}
					inner join ${contentStructure}
						on ${contentStructure.id} = ${contentStructureNode.structureId}
					where ${contentStructureNode.ownerUnitId} = ${request.scopeUnitId}::uuid
						and ${contentStructureNode.contentUnitId} = ${searchUnit.id}
						and ${contentStructureNode.deletedAt} is null
						and ${contentStructure.deletedAt} is null
						and ${contentStructure.kind} in ('book.contents', 'post.contents')
				))`
				: direct,
		);
	}
	if (request.domainFilter)
		conditions.push(
			compileUnitPredicateSql(request.domainFilter, {
				unitId: sql`${searchUnit.id}`,
				unitOwner: sql`${searchUnit.owner}`,
				unitShape: sql`${searchUnit.shape}`,
				viewerProfileId: request.profileId,
			}),
		);
	return conditions;
}

function buildSearchConditions(
	category: SearchCategory,
	request: DomainSearchRequest,
	expression: SearchExpression | undefined,
	includeCommonConditions = true,
): SQL[] {
	validateRequest(category, request);
	const conditions = includeCommonConditions ? buildCommonSearchConditions(request) : [];
	conditions.push(
		sql`${searchUnit.owner}::text = ANY(${toTextArray(CurrentSearchOwnersByCategory[category])})`,
	);
	if (category === "posts")
		conditions.push(sql`exists (
			select 1 from ${post}
			where ${post.id} = ${searchUnit.id} and ${post.kind} <> 'review'::post_kind
		)`);
	if (category === "reviews")
		conditions.push(sql`exists (
			select 1 from ${post}
			where ${post.id} = ${searchUnit.id} and ${post.kind} = 'review'::post_kind
		)`);

	if (expression)
		conditions.push(compilePostgresSearchExpression(category, expression, request.profileId));
	return conditions;
}

function buildEffectiveSearchExpression(
	request: DomainSearchRequest,
): SearchExpression | undefined {
	const filters: SearchControlPredicate[] = [];
	type DomainRequestScalarField = Exclude<SearchScalarField, "collection">;
	const addValues = (field: DomainRequestScalarField, values: readonly string[] | undefined) => {
		if (values?.length) filters.push({ field, operator: "any-of", values: [...values] });
	};
	const addValue = (field: DomainRequestScalarField, value: string | undefined) => {
		if (value) filters.push({ field, operator: "equals", value });
	};
	const addBoolean = (field: DomainRequestScalarField, value: boolean | undefined) => {
		if (value !== undefined) filters.push({ field, operator: "equals", value });
	};
	addValues(SearchFieldByDomainRequestFilter.Languages, request.Languages);
	addValues(SearchFieldByDomainRequestFilter.owner, request.owners);
	addValues(SearchFieldByDomainRequestFilter.shape, request.shapes);
	addValues(SearchFieldByDomainRequestFilter.contentRating, request.contentRatings);
	addValues(SearchFieldByDomainRequestFilter.aiDisclosure, request.aiDisclosures);
	addValues(SearchFieldByDomainRequestFilter.license, request.licenses);
	addValue(SearchFieldByDomainRequestFilter.creditedEntityId, request.creditedEntityId);
	addValue(SearchFieldByDomainRequestFilter.realmId, request.realmId);
	addValue(SearchFieldByDomainRequestFilter.realmTagContextRealmId, request.realmTagContextRealmId);
	addValue(SearchFieldByDomainRequestFilter.subjectId, request.subjectId);
	addValue(SearchFieldByDomainRequestFilter.targetId, request.targetId);
	addValue(SearchFieldByDomainRequestFilter.rootId, request.rootId);
	addValue(SearchFieldByDomainRequestFilter.parentId, request.parentId);
	addValue(SearchFieldByDomainRequestFilter.ownerId, request.ownerId);
	addValues(SearchFieldByDomainRequestFilter.joinPolicy, request.joinPolicies);
	addBoolean(SearchFieldByDomainRequestFilter.multiple, request.multiple);
	addValues(SearchFieldByDomainRequestFilter.resultsVisibility, request.resultsVisibilities);
	addBoolean(SearchFieldByDomainRequestFilter.closesAt, request.closed);
	const expression = combineSearchExpressions("all", [
		...filters,
		...(request.searchExpression ? [request.searchExpression] : []),
	]);
	if (expression) assertSearchExpression(expression, { maxDepth: 6, maxNodes: 100 });
	return expression;
}

/** @internal Proves that one category-specific request can reach both search engines. */
export function validateSearchDomainRequest(
	category: SearchCategory,
	request: DomainSearchRequest,
): void {
	const expression = buildEffectiveSearchExpression(request);
	buildSearchConditions(category, request, expression);
}

interface SearchIdentifier {
	readonly id: string;
}

interface SearchDomainScanResult<Hit extends SearchIdentifier> {
	readonly hits: Hit[];
	readonly total: SearchCountResult;
	readonly offset: number;
	readonly nextOffset: number;
	readonly exhausted: boolean;
	readonly nextCursor?: GroupedSearchCursorToken;
	readonly nextPosition?: SearchKeysetPosition;
	readonly limit: number;
	readonly processingTimeMs: number;
}

interface SearchCandidateRow extends Record<string, unknown> {
	readonly id: string;
	readonly primaryValue: string;
	readonly secondaryValue: string;
	readonly position: SearchKeysetPosition;
}

interface SearchCandidatePage {
	readonly rows: readonly SearchCandidateRow[];
	readonly hasMore: boolean;
	readonly nextPosition?: SearchKeysetPosition;
	readonly scannedCount: number;
	readonly boundedTextFallback: boolean;
}

interface SearchCandidateDatabaseRow extends Record<string, unknown> {
	readonly id: string | null;
	readonly primaryValue: string | null;
	readonly secondaryValue: string | null;
	readonly source: CandidateSourceName | null;
	readonly snapshotId: string | null;
	readonly hasMore: boolean;
	readonly continuationPrimary: string | null;
	readonly continuationSecondary: string | null;
	readonly continuationUnitId: string | null;
	readonly continuationSource: CandidateSourceName | null;
	readonly continuationSnapshotId: string | null;
	readonly scannedCount: number;
	readonly snapshotAvailable: boolean;
	readonly boundedTextFallback: boolean;
}

type CandidateSourceName =
	| "ordered"
	| "best-positive"
	| "best-zero"
	| "count-positive"
	| "count-zero";

function isCandidateSourceName(value: unknown): value is CandidateSourceName {
	return (
		value === "ordered" ||
		value === "best-positive" ||
		value === "best-zero" ||
		value === "count-positive" ||
		value === "count-zero"
	);
}

function searchKeysetPosition(input: {
	readonly primary: string;
	readonly secondary: string;
	readonly unitId: string;
	readonly source: CandidateSourceName;
	readonly snapshotId: string | null;
}): SearchKeysetPosition {
	const base = {
		primary: input.primary,
		secondary: input.secondary,
		unitId: input.unitId,
	} as const;
	return input.source === "best-positive" || input.source === "best-zero"
		? { ...base, source: input.source, snapshotId: input.snapshotId }
		: input.source === "count-positive" || input.source === "count-zero"
			? { ...base, source: input.source }
			: { ...base, source: "ordered" };
}

function readSearchCandidatePage(rows: readonly SearchCandidateDatabaseRow[]): SearchCandidatePage {
	const metadata = rows[0];
	if (!metadata) throw new Error("PostgreSQL returned no Search candidate metadata");
	if (!metadata.snapshotAvailable) throw new InvalidSearch("Search cursor snapshot has expired");
	const candidates: SearchCandidateRow[] = [];
	for (const row of rows) {
		if (row.id === null && row.primaryValue === null && row.secondaryValue === null) continue;
		if (
			typeof row.id !== "string" ||
			typeof row.primaryValue !== "string" ||
			typeof row.secondaryValue !== "string" ||
			!isCandidateSourceName(row.source)
		)
			throw new Error("PostgreSQL returned an invalid Search candidate row");
		candidates.push({
			id: row.id,
			primaryValue: row.primaryValue,
			secondaryValue: row.secondaryValue,
			position: searchKeysetPosition({
				primary: row.primaryValue,
				secondary: row.secondaryValue,
				unitId: row.id,
				source: row.source,
				snapshotId: row.snapshotId,
			}),
		});
	}
	if (!metadata.hasMore)
		return {
			rows: candidates,
			hasMore: false,
			scannedCount: metadata.scannedCount,
			boundedTextFallback: metadata.boundedTextFallback,
		};
	if (
		metadata.continuationPrimary === null ||
		metadata.continuationSecondary === null ||
		metadata.continuationUnitId === null ||
		!isCandidateSourceName(metadata.continuationSource)
	)
		throw new Error("PostgreSQL omitted the Search continuation position");
	const nextPosition = searchKeysetPosition({
		primary: metadata.continuationPrimary,
		secondary: metadata.continuationSecondary,
		unitId: metadata.continuationUnitId,
		source: metadata.continuationSource,
		snapshotId: metadata.continuationSnapshotId,
	});
	return {
		rows: candidates,
		hasMore: true,
		nextPosition,
		scannedCount: metadata.scannedCount,
		boundedTextFallback: metadata.boundedTextFallback,
	};
}

interface PreparedSearchBranch {
	readonly category: SearchCategory;
	readonly conditions: readonly SQL[];
	readonly sourceOwners: readonly UnitOwner[];
	readonly sourceShapes: readonly string[];
}

interface OrderedCandidateSource {
	readonly statement: SQL;
	readonly direction: "asc" | "desc";
}

const publicDiscoverableCandidate = sql`${searchUnit.status} = 'published'
	and ${searchUnit.visibility} = 'public'
	and ${searchUnit.moderationStatus} = 'approved'
	and ${searchUnit.deletedAt} is null`;

function resolveSourceOwners(
	category: SearchCategory,
	requestedKinds?: readonly string[],
): readonly UnitOwner[] {
	const categoryKinds = CurrentSearchOwnersByCategory[category];
	if (category !== "units" || !requestedKinds?.length) return categoryKinds;
	const requested = new Set(
		requestedKinds.filter((kind): kind is UnitOwner =>
			UnitOwnerValues.some((candidate) => candidate === kind),
		),
	);
	return categoryKinds.filter((kind) => requested.has(kind));
}

function mergeSourceShapes(branches: readonly PreparedSearchBranch[]): readonly string[] {
	return branches.some((branch) => !branch.sourceShapes.length)
		? []
		: [...new Set(branches.flatMap((branch) => branch.sourceShapes))];
}

function mergeSourceOwners(branches: readonly PreparedSearchBranch[]): readonly UnitOwner[] {
	return [...new Set(branches.flatMap(({ sourceOwners }) => sourceOwners))];
}

function requirePositionValues(position: SearchKeysetPosition): {
	readonly primary: string;
	readonly secondary: string;
} {
	if (position.primary === null || position.secondary === null)
		throw new InvalidSearch("Search cursor is missing a sort value");
	return { primary: position.primary, secondary: position.secondary };
}

function requireOrderedPosition(
	position: SearchKeysetPosition | undefined,
): SearchKeysetPosition | undefined {
	if (position?.source && position.source !== "ordered")
		throw new InvalidSearch("Search cursor does not match this ordering source");
	return position;
}

function bigintKeysetCondition(
	column: SQL,
	id: SQL,
	direction: "asc" | "desc",
	position: SearchKeysetPosition | undefined,
): SQL {
	if (!position) return sql`true`;
	const { primary } = requirePositionValues(position);
	return direction === "asc"
		? sql`(${column}, ${id}) > (${primary}::bigint, ${position.unitId}::uuid)`
		: sql`(${column}, ${id}) < (${primary}::bigint, ${position.unitId}::uuid)`;
}

function timestampKeysetCondition(
	column: SQL,
	id: SQL,
	direction: "asc" | "desc",
	position: SearchKeysetPosition | undefined,
	value: "primary" | "secondary" = "primary",
): SQL {
	if (!position) return sql`true`;
	const values = requirePositionValues(position);
	const cursorTimestamp = sql`to_timestamp(${values[value]}::double precision)`;
	return direction === "asc"
		? sql`(${column}, ${id}) > (${cursorTimestamp}, ${position.unitId}::uuid)`
		: sql`(${column}, ${id}) < (${cursorTimestamp}, ${position.unitId}::uuid)`;
}

function idKeysetCondition(
	id: SQL,
	direction: "asc" | "desc",
	position: SearchKeysetPosition | undefined,
): SQL {
	if (!position) return sql`true`;
	return direction === "asc"
		? sql`${id} > ${position.unitId}::uuid`
		: sql`${id} < ${position.unitId}::uuid`;
}

function nullableTimestampCandidateSource(input: {
	readonly column: SQL;
	readonly id: SQL;
	readonly relation: SQL;
	readonly baseCondition: SQL;
	readonly direction: "asc" | "desc";
	readonly position: SearchKeysetPosition | undefined;
	readonly limit: number;
}): OrderedCandidateSource {
	const { primary } = input.position
		? requirePositionValues(input.position)
		: { primary: undefined };
	const sentinelNumber = input.direction === "asc" ? 1e100 : -1e100;
	const positionIsNull = primary !== undefined && Number(primary) === sentinelNumber;
	const orderDirection = input.direction === "asc" ? sql`asc` : sql`desc`;
	const sentinel = input.direction === "asc" ? sql`1e100::numeric` : sql`-1e100::numeric`;
	const branches: SQL[] = [];
	if (!positionIsNull) {
		branches.push(sql`
			select ${input.id} as unit_id,
				extract(epoch from ${input.column})::numeric as primary_order,
				0::numeric as secondary_order,
				0::integer as source_phase,
				'ordered'::text as source_name,
				null::uuid as snapshot_id,
				false as search_fallback
			from ${input.relation}
			where ${input.baseCondition}
				and ${input.column} is not null
				and ${timestampKeysetCondition(input.column, input.id, input.direction, input.position)}
			order by ${input.column} ${orderDirection}, ${input.id} ${orderDirection}
			limit ${input.limit}`);
	}
	branches.push(sql`
		select ${input.id} as unit_id,
			${sentinel} as primary_order,
			0::numeric as secondary_order,
			1::integer as source_phase,
			'ordered'::text as source_name,
			null::uuid as snapshot_id,
			false as search_fallback
		from ${input.relation}
		where ${input.baseCondition}
			and ${input.column} is null
			and ${idKeysetCondition(
				input.id,
				input.direction,
				positionIsNull ? input.position : undefined,
			)}
		order by ${input.id} ${orderDirection}
		limit ${input.limit}`);
	return {
		direction: input.direction,
		statement: sql`
			select nullable_source.*
			from (${sql.join(
				branches.map((branch) => sql`(${branch})`),
				sql` union all `,
			)}) as nullable_source
			order by source_phase asc, primary_order ${orderDirection},
				secondary_order ${orderDirection}, unit_id ${orderDirection}
			limit ${input.limit}`,
	};
}

function bestCandidateSource(
	position: SearchKeysetPosition | undefined,
	limit: number,
	seeded = false,
	sourceOwners?: readonly UnitOwner[],
	shapes: readonly string[] = [],
	bestSnapshotId?: string | null,
): OrderedCandidateSource {
	if (position && position.source !== "best-positive" && position.source !== "best-zero")
		throw new InvalidSearch("This best cursor predates snapshot-pinned pagination");
	if (sourceOwners?.length === 0)
		return {
			direction: "desc",
			statement: sql`select null::uuid as unit_id, 0::numeric as primary_order,
				0::numeric as secondary_order, 0::integer as source_phase,
				'best-zero'::text as source_name, null::uuid as snapshot_id,
				false as search_fallback where false`,
		};
	const bestPosition =
		position?.source === "best-positive" || position?.source === "best-zero" ? position : undefined;
	const selectedSnapshotId = bestPosition ? bestPosition.snapshotId : bestSnapshotId;
	const selectedSnapshot =
		selectedSnapshotId !== undefined
			? selectedSnapshotId === null
				? sql`select ${recommendationSnapshot.id} from ${recommendationSnapshot} where false`
				: sql`select ${recommendationSnapshot.id}
				from ${recommendationSnapshot}
				where ${recommendationSnapshot.id} = ${selectedSnapshotId}::uuid
					and ${recommendationSnapshot.state} = 'ready'::recommendation_snapshot_state`
			: sql`select ${recommendationSnapshot.id}
			from ${recommendationSnapshot}
			where ${recommendationSnapshot.active} = true
			limit 1`;
	const positivePosition = bestPosition?.source === "best-positive" ? bestPosition : undefined;
	const zeroPosition = bestPosition?.source === "best-zero" ? bestPosition : undefined;
	const includePositive = bestPosition?.source !== "best-zero" && selectedSnapshotId !== null;
	const positiveKeyset = positivePosition
		? (() => {
				const { primary, secondary } = requirePositionValues(positivePosition);
				return sql`(
					${unitBestScore.score},
					${unitBestScore.unitUpdatedAt},
					${unitBestScore.unitId}
				) < (
					${primary}::double precision,
					to_timestamp(${secondary}::double precision),
					${positivePosition.unitId}::uuid
				)`;
			})()
		: sql`true`;
	const kindDimensions: readonly UnitOwner[] = sourceOwners ?? UnitOwnerValues;
	const positiveByKind = kindDimensions.map(
		(kind) => sql`
			select ${unitBestScore.unitId} as unit_id,
				${unitBestScore.score}::numeric as primary_order,
				extract(epoch from ${unitBestScore.unitUpdatedAt})::numeric as secondary_order,
				0::integer as source_phase,
				'best-positive'::text as source_name,
				${unitBestScore.snapshotId} as snapshot_id,
				false as search_fallback
			from ${unitBestScore}
			${
				seeded
					? sql`inner join filter_seed on filter_seed.unit_id = ${unitBestScore.unitId}`
					: sql``
			}
			inner join selected_best_snapshot
				on selected_best_snapshot.id = ${unitBestScore.snapshotId}
			where ${kind ? sql`${unitBestScore.unitOwner} = ${kind}` : sql`true`}
				and ${shapes.length ? sql`${unitBestScore.unitShape} = any(${toTextArray(shapes)})` : sql`true`}
				and ${positiveKeyset}
			order by ${unitBestScore.score} desc,
				${unitBestScore.unitUpdatedAt} desc,
				${unitBestScore.unitId} desc
			limit ${limit}`,
	);
	const positive = sql`
		select positive_kind_source.*
		from (${sql.join(
			positiveByKind.map((branch) => sql`(${branch})`),
			sql` union all `,
		)}) as positive_kind_source
		order by primary_order desc, secondary_order desc, unit_id desc
		limit ${limit}`;
	const zeroByKind = kindDimensions.map(
		(kind) => sql`
			select ${searchUnit.id} as unit_id,
				0::numeric as primary_order,
				extract(epoch from ${searchUnit.updatedAt})::numeric as secondary_order,
				1::integer as source_phase,
				'best-zero'::text as source_name,
				(select id from selected_best_snapshot) as snapshot_id,
				false as search_fallback
			from ${ownerSearchRelation(kind, shapes)}
			${seeded ? sql`inner join filter_seed on filter_seed.unit_id = ${searchUnit.id}` : sql``}
			where ${publicDiscoverableCandidate}
				and ${shapes.length ? sql`${searchUnit.shape} = any(${toTextArray(shapes)})` : sql`true`}
				and not exists (
					select 1
					from ${unitBestScore}
					inner join selected_best_snapshot
						on selected_best_snapshot.id = ${unitBestScore.snapshotId}
					where ${unitBestScore.unitId} = ${searchUnit.id}
				)
				and ${timestampKeysetCondition(
					sql`${searchUnit.updatedAt}`,
					sql`${searchUnit.id}`,
					"desc",
					zeroPosition,
					"secondary",
				)}
			order by ${searchUnit.updatedAt} desc, ${searchUnit.id} desc
			limit ${limit}`,
	);
	const zero = sql`
		select zero_kind_source.*
		from (${sql.join(
			zeroByKind.map((branch) => sql`(${branch})`),
			sql` union all `,
		)}) as zero_kind_source
		order by secondary_order desc, unit_id desc
		limit ${limit}`;
	const branches = includePositive ? [positive, zero] : [zero];
	return {
		direction: "desc",
		statement: sql`
			with selected_best_snapshot as materialized (${selectedSnapshot})
			select best_source.*
			from (${sql.join(
				branches.map((branch) => sql`(${branch})`),
				sql` union all `,
			)}) as best_source
			order by source_phase asc, primary_order desc, secondary_order desc, unit_id desc
			limit ${limit}`,
	};
}

function sparseFollowerCandidateSource(
	position: SearchKeysetPosition | undefined,
	direction: "asc" | "desc",
	limit: number,
	seeded = false,
): OrderedCandidateSource {
	if (position && position.source !== "count-positive" && position.source !== "count-zero")
		throw new InvalidSearch("This count cursor predates sparse index pagination");
	const positivePhase = direction === "desc" ? 0 : 1;
	const zeroPhase = direction === "asc" ? 0 : 1;
	const cursorPhase =
		position?.source === "count-positive"
			? positivePhase
			: position?.source === "count-zero"
				? zeroPhase
				: undefined;
	const branches: SQL[] = [];
	const orderDirection = direction === "asc" ? sql`asc` : sql`desc`;
	if (cursorPhase === undefined || positivePhase >= cursorPhase) {
		const positivePosition =
			cursorPhase === positivePhase && position?.source === "count-positive" ? position : undefined;
		const orderDirection = direction === "asc" ? sql`asc` : sql`desc`;
		branches.push(sql`
			select ${unitFollowStat.unitId} as unit_id,
				${unitFollowStat.followerCount}::numeric as primary_order,
				0::numeric as secondary_order,
				${positivePhase}::integer as source_phase,
				'count-positive'::text as source_name,
				null::uuid as snapshot_id,
				false as search_fallback
			from ${unitFollowStat}
			${
				seeded
					? sql`inner join filter_seed on filter_seed.unit_id = ${unitFollowStat.unitId}`
					: sql``
			}
			where ${unitFollowStat.followerCount} > 0 and ${unitFollowStat.unitRealmId} is not null
				and ${bigintKeysetCondition(
					sql`${unitFollowStat.followerCount}`,
					sql`${unitFollowStat.unitId}`,
					direction,
					positivePosition,
				)}
			order by ${unitFollowStat.followerCount} ${orderDirection},
				${unitFollowStat.unitId} ${orderDirection}
			limit ${limit}`);
	}
	if (cursorPhase === undefined || zeroPhase >= cursorPhase) {
		const zeroPosition =
			cursorPhase === zeroPhase && position?.source === "count-zero" ? position : undefined;
		branches.push(sql`
			select ${searchUnit.id} as unit_id,
				0::numeric as primary_order,
				0::numeric as secondary_order,
				${zeroPhase}::integer as source_phase,
				'count-zero'::text as source_name,
				null::uuid as snapshot_id,
				false as search_fallback
			from ${ownerSearchRelation("realm")}
			${seeded ? sql`inner join filter_seed on filter_seed.unit_id = ${searchUnit.id}` : sql``}
			where ${publicDiscoverableCandidate}
				and not exists (
					select 1 from ${unitFollowStat}
					where ${unitFollowStat.unitId} = ${searchUnit.id}
						and ${unitFollowStat.followerCount} > 0
				)
				and ${idKeysetCondition(sql`${searchUnit.id}`, direction, zeroPosition)}
			order by ${searchUnit.id} ${orderDirection}
			limit ${limit}`);
	}
	return {
		direction,
		statement: sql`
			select count_source.*
			from (${sql.join(
				branches.map((branch) => sql`(${branch})`),
				sql` union all `,
			)}) as count_source
			order by source_phase asc, primary_order ${orderDirection},
				secondary_order ${orderDirection}, unit_id ${orderDirection}
			limit ${limit}`,
	};
}

function textCandidateSource(
	query: ExpandedSearchQuery,
	languageBoundary: readonly ContentLanguage[],
	sourceOwners: readonly UnitOwner[],
	shapes: readonly string[],
	position: SearchKeysetPosition | undefined,
	limit: number,
): OrderedCandidateSource {
	const orderedPosition = requireOrderedPosition(position);
	const cursorValues = orderedPosition ? requirePositionValues(orderedPosition) : undefined;
	const cursorMicros = cursorValues
		? sql`round(${cursorValues.primary}::numeric * 1000000)::bigint`
		: sql`null::bigint`;
	if (!sourceOwners.length)
		return {
			direction: "desc",
			statement: sql`select null::uuid as unit_id, 0::numeric as primary_order,
				0::numeric as secondary_order, 0::integer as source_phase,
				'ordered'::text as source_name, null::uuid as snapshot_id,
				false as search_fallback, false as search_matched where false`,
		};
	const kindSources = sourceOwners.map(
		(kind) => sql`
			select text_candidate.unit_id,
				(text_candidate.unit_updated_at_micros::numeric / 1000000) as primary_order,
				0::numeric as secondary_order,
				0::integer as source_phase,
				'ordered'::text as source_name,
				null::uuid as snapshot_id,
				(not text_candidate.search_matched) as search_fallback,
				text_candidate.search_matched
			from ${
				CatalogOwnerValues.some((owner) => owner === kind)
					? sql`public.search_catalog_name_candidates(${kind}, ${toTextArray(query.variants)}, ${toTextArray(languageBoundary)}, ${toTextArray(shapes)}, ${cursorMicros}, ${orderedPosition?.unitId ?? null}::uuid, ${WorkPolicy.search.maxEstimatedPostings}, ${limit})`
					: sql`public.search_text_candidates(${toTextArray(query.variants)}, ${toTextArray(languageBoundary)}, ${kind}, ${toTextArray(shapes)}, ${cursorMicros}, ${orderedPosition?.unitId ?? null}::uuid, ${WorkPolicy.search.maxEstimatedPostings}, ${limit})`
			} as text_candidate
			order by text_candidate.unit_updated_at_micros desc,
				text_candidate.unit_id desc
			limit ${limit}`,
	);
	return {
		direction: "desc",
		statement: sql`
			select text_kind_source.*
			from (${sql.join(
				kindSources.map((branch) => sql`(${branch})`),
				sql` union all `,
			)}) as text_kind_source
			order by primary_order desc, unit_id desc
			limit ${limit}`,
	};
}

function seededUnitCandidateSource(
	sort: SearchSort,
	position: SearchKeysetPosition | undefined,
	limit: number,
	sourceOwners: readonly UnitOwner[],
	shapes: readonly string[],
	bestSnapshotId?: string | null,
): OrderedCandidateSource | undefined {
	if (sort === "best")
		return bestCandidateSource(position, limit, true, sourceOwners, shapes, bestSnapshotId);
	if (sort === "followerCount:asc" || sort === "followerCount:desc")
		return sparseFollowerCandidateSource(
			position,
			sort.endsWith(":asc") ? "asc" : "desc",
			limit,
			true,
		);
	const direction = sort.endsWith(":asc") ? "asc" : "desc";
	const orderDirection = direction === "asc" ? sql`asc` : sql`desc`;
	const orderedPosition = requireOrderedPosition(position);
	if (sort === "replyCount:asc" || sort === "replyCount:desc")
		return {
			direction,
			statement: sql`
				select ${postReplyStat.postId} as unit_id,
					${postReplyStat.searchReplyCount}::numeric as primary_order,
					0::numeric as secondary_order,
					0::integer as source_phase,
					'ordered'::text as source_name,
					null::uuid as snapshot_id,
					false as search_fallback
				from ${postReplyStat}
				inner join filter_seed on filter_seed.unit_id = ${postReplyStat.postId}
				where ${bigintKeysetCondition(
					sql`${postReplyStat.searchReplyCount}`,
					sql`${postReplyStat.postId}`,
					direction,
					orderedPosition,
				)}
				order by ${postReplyStat.searchReplyCount} ${orderDirection},
					${postReplyStat.postId} ${orderDirection}
				limit ${limit}`,
		};
	if (sort === "closesAt:asc" || sort === "closesAt:desc")
		return nullableTimestampCandidateSource({
			column: sql`${poll.closesAt}`,
			id: sql`${poll.id}`,
			relation: sql`${poll} inner join filter_seed on filter_seed.unit_id = ${poll.id}`,
			baseCondition: sql`true`,
			direction,
			position: orderedPosition,
			limit,
		});
	return ownerOrderedCandidateSource(
		sort === "relevance" ? "updatedAt:desc" : sort,
		position,
		limit,
		sourceOwners,
		shapes,
		true,
	);
}

function ownerOrderedCandidateSource(
	sort: SearchSort,
	position: SearchKeysetPosition | undefined,
	limit: number,
	owners: readonly UnitOwner[],
	shapes: readonly string[],
	seeded = false,
): OrderedCandidateSource {
	const direction = sort.endsWith(":asc") ? "asc" : "desc";
	const orderDirection = direction === "asc" ? sql`asc` : sql`desc`;
	const timestamp = sort.startsWith("createdAt:")
		? sql`${searchUnit.createdAt}`
		: sort.startsWith("publishedAt:")
			? sql`${searchUnit.publishedAt}`
			: sort.startsWith("updatedAt:")
				? sql`${searchUnit.updatedAt}`
				: undefined;
	if (!timestamp) throw new InvalidSearch(`${sort} has no native owner ordering`);
	const orderedPosition = requireOrderedPosition(position);
	const baseCondition = sql`${publicDiscoverableCandidate} and ${shapes.length ? sql`${searchUnit.shape}=any(${toTextArray(shapes)})` : sql`true`}`;
	const branches = owners.map((owner) => {
		const relation = sql`${ownerSearchRelation(owner, shapes)} ${seeded ? sql`inner join filter_seed on filter_seed.unit_id = ${searchUnit.id}` : sql``}`;
		if (sort.startsWith("publishedAt:"))
			return nullableTimestampCandidateSource({
				column: timestamp,
				id: sql`${searchUnit.id}`,
				relation,
				baseCondition,
				direction,
				position: orderedPosition,
				limit,
			}).statement;
		return sql`select ${searchUnit.id} as unit_id, extract(epoch from ${timestamp})::numeric as primary_order,
   0::numeric as secondary_order, 0::integer as source_phase, 'ordered'::text as source_name,
   null::uuid as snapshot_id, false as search_fallback
   from ${relation} where ${baseCondition}
   and ${timestampKeysetCondition(timestamp, sql`${searchUnit.id}`, direction, orderedPosition)}
   order by ${timestamp} ${orderDirection}, ${searchUnit.id} ${orderDirection} limit ${limit}`;
	});
	return {
		direction,
		statement: branches.length
			? sql`select native_source.* from (${sql.join(
					branches.map((branch) => sql`(${branch})`),
					sql` union all `,
				)}) native_source
 order by source_phase asc, primary_order ${orderDirection}, secondary_order ${orderDirection}, unit_id ${orderDirection} limit ${limit}`
			: sql`select null::uuid as unit_id, 0::numeric as primary_order, 0::numeric as secondary_order, 0::integer as source_phase, 'ordered'::text as source_name, null::uuid as snapshot_id, false as search_fallback where false`,
	};
}

function orderedCandidateSource(input: {
	readonly query: ExpandedSearchQuery;
	readonly sort: SearchSort;
	readonly position?: SearchKeysetPosition;
	readonly bestSnapshotId?: string | null;
	readonly languageBoundary: readonly ContentLanguage[];
	readonly sourceOwners: readonly UnitOwner[];
	readonly sourceShapes: readonly string[];
	readonly limit: number;
}): OrderedCandidateSource {
	if (input.sort === "relevance")
		return textCandidateSource(
			input.query,
			input.languageBoundary,
			input.sourceOwners,
			input.sourceShapes,
			input.position,
			input.limit,
		);
	if (input.sort === "best")
		return bestCandidateSource(
			input.position,
			input.limit,
			false,
			input.sourceOwners,
			input.sourceShapes,
			input.bestSnapshotId,
		);
	const direction = input.sort.endsWith(":asc") ? "asc" : "desc";
	if (input.sort === "followerCount:asc" || input.sort === "followerCount:desc")
		return sparseFollowerCandidateSource(input.position, direction, input.limit);
	const orderDirection = direction === "asc" ? sql`asc` : sql`desc`;
	const position = requireOrderedPosition(input.position);
	if (input.sort === "replyCount:asc" || input.sort === "replyCount:desc")
		return {
			direction,
			statement: sql`
				select ${postReplyStat.postId} as unit_id,
					${postReplyStat.searchReplyCount}::numeric as primary_order,
					0::numeric as secondary_order,
					0::integer as source_phase,
					'ordered'::text as source_name,
					null::uuid as snapshot_id,
					false as search_fallback
				from ${postReplyStat}
				where ${bigintKeysetCondition(
					sql`${postReplyStat.searchReplyCount}`,
					sql`${postReplyStat.postId}`,
					direction,
					position,
				)}
				order by ${postReplyStat.searchReplyCount} ${orderDirection},
					${postReplyStat.postId} ${orderDirection}
				limit ${input.limit}`,
		};
	if (input.sort === "closesAt:asc" || input.sort === "closesAt:desc")
		return nullableTimestampCandidateSource({
			column: sql`${poll.closesAt}`,
			id: sql`${poll.id}`,
			relation: sql`${poll}`,
			baseCondition: sql`true`,
			direction,
			position,
			limit: input.limit,
		});
	return ownerOrderedCandidateSource(
		input.sort,
		input.position,
		input.limit,
		input.sourceOwners,
		input.sourceShapes,
	);
}

function currentSearchDocumentCondition(
	query: ExpandedSearchQuery,
	languageBoundary: readonly ContentLanguage[],
): SQL {
	const languageColumns: Readonly<Record<ContentLanguage, SQL>> = {
		zh: sql`${boundedSearchDocument.textZh}`,
		en: sql`${boundedSearchDocument.textEn}`,
		ja: sql`${boundedSearchDocument.textJa}`,
		ko: sql`${boundedSearchDocument.textKo}`,
		de: sql`${boundedSearchDocument.textDe}`,
		fr: sql`${boundedSearchDocument.textFr}`,
		es: sql`${boundedSearchDocument.textEs}`,
	};
	const columns = languageBoundary.length
		? languageBoundary.map((language) => languageColumns[language])
		: [sql`${boundedSearchDocument.textAll}`];
	return sql`(${sql.join(
		columns.map(
			(column) =>
				sql`(${sql.join(
					query.variants.map(
						(variant) => sql`${column} &@~ public.pgroonga_query_escape(${variant})`,
					),
					sql` or `,
				)})`,
		),
		sql` or `,
	)})`;
}

function currentSearchSources(
	query: ExpandedSearchQuery,
	languageBoundary: readonly ContentLanguage[],
	candidateRelation: SQL,
	sourceMayPreMatch: boolean,
): SQL {
	if (!query.query)
		return sql`select bounded_search_candidate.unit_id
			from ${candidateRelation} as bounded_search_candidate`;
	const boundedMatch = sql`(public.catalog_name_matches(bounded_search_candidate.unit_id, ${toTextArray(query.variants)}, ${toTextArray(languageBoundary)}) or exists (
		select 1
		from ${unitSearchDocument} as ${boundedSearchDocument}
		where ${boundedSearchDocument.unitId} = bounded_search_candidate.unit_id
			and ${currentSearchDocumentCondition(query, languageBoundary)}
	))`;
	if (!sourceMayPreMatch)
		return sql`select bounded_search_candidate.unit_id
			from ${candidateRelation} as bounded_search_candidate
			where ${boundedMatch}`;
	return sql`
		select bounded_search_candidate.unit_id
		from ${candidateRelation} as bounded_search_candidate
		where bounded_search_candidate.search_matched
		union all
		select bounded_search_candidate.unit_id
		from ${candidateRelation} as bounded_search_candidate
		where not bounded_search_candidate.search_matched
			and ${boundedMatch}
	`;
}

async function searchCandidateBatch(input: {
	readonly branches: readonly PreparedSearchBranch[];
	readonly candidateSet?: Readonly<{ statement: SQL; materialized: boolean }>;
	readonly commonConditions?: readonly SQL[];
	readonly query: ExpandedSearchQuery;
	readonly sort: SearchSort;
	readonly position?: SearchKeysetPosition;
	readonly bestSnapshotId?: string | null;
	readonly limit: number;
	readonly scanLimit: number;
	readonly languageBoundary: readonly ContentLanguage[];
}): Promise<SearchCandidatePage> {
	if (!input.branches.length)
		return { rows: [], hasMore: false, scannedCount: 0, boundedTextFallback: false };
	const source =
		(input.candidateSet
			? seededUnitCandidateSource(
					input.sort,
					input.position,
					input.scanLimit + 1,
					mergeSourceOwners(input.branches),
					mergeSourceShapes(input.branches),
					input.bestSnapshotId,
				)
			: undefined) ??
		orderedCandidateSource({
			query: input.query,
			sort: input.sort,
			position: input.position,
			bestSnapshotId: input.bestSnapshotId,
			languageBoundary: input.languageBoundary,
			sourceOwners: mergeSourceOwners(input.branches),
			sourceShapes: mergeSourceShapes(input.branches),
			limit: input.scanLimit + 1,
		});
	const branchConditions = input.branches.map(
		(branch) => sql`(${sql.join([...branch.conditions], sql` and `)})`,
	);
	const eligibilityConditions = [
		...(input.commonConditions ?? []),
		sql`(${sql.join(branchConditions, sql` or `)})`,
	];
	const orderDirection = source.direction === "asc" ? sql`asc` : sql`desc`;
	const boundedSearchSources = currentSearchSources(
		input.query,
		input.languageBoundary,
		sql`scanned_candidates`,
		input.sort === "relevance",
	);
	const checkedSnapshotId =
		input.position?.source === "best-positive" || input.position?.source === "best-zero"
			? input.position.snapshotId
			: input.bestSnapshotId;
	const snapshotAvailable =
		input.sort === "best" && checkedSnapshotId !== undefined
			? checkedSnapshotId === null
				? sql`true`
				: sql`exists (
					select 1 from ${recommendationSnapshot}
					where ${recommendationSnapshot.id} = ${checkedSnapshotId}::uuid
						and ${recommendationSnapshot.state} = 'ready'::recommendation_snapshot_state
				)`
			: sql`true`;
	const result = await database.transaction(async (tx) => {
		await tx.execute(
			sql`select set_config('statement_timeout', ${String(boundedSearchStatementTimeout(env.SEARCH_STATEMENT_TIMEOUT_MS))}, true)`,
		);
		return tx.execute<SearchCandidateDatabaseRow>(sql`
			with ${
				input.candidateSet
					? input.candidateSet.materialized
						? sql`filter_seed(unit_id) as materialized (${input.candidateSet.statement}),`
						: sql`filter_seed(unit_id) as not materialized (${input.candidateSet.statement}),`
					: sql``
			} ordered_source as materialized (
				${source.statement}
			), scanned_candidates as materialized (
				select * from ordered_source
				order by source_phase asc, primary_order ${orderDirection},
					secondary_order ${orderDirection}, unit_id ${orderDirection}
				limit ${input.scanLimit}
			), raw_search_sources(unit_id) as materialized (
				${boundedSearchSources}
			), search_sources(unit_id) as materialized (
				select distinct unit_id
				from raw_search_sources
			), eligible_matches as (
				select ${searchUnit.id} as unit_id,
					scanned_candidates.primary_order,
					scanned_candidates.secondary_order,
					scanned_candidates.source_phase,
					scanned_candidates.source_name,
					scanned_candidates.snapshot_id
				from scanned_candidates
				inner join search_sources on search_sources.unit_id = scanned_candidates.unit_id
				inner join ${searchState(sql`scanned_candidates.unit_id`)} on true
				where ${sql.join(eligibilityConditions, sql` and `)}
			), accepted as materialized (
				select unit_id, primary_order, secondary_order, source_phase,
					source_name, snapshot_id
				from eligible_matches
				order by source_phase asc, primary_order ${orderDirection},
					secondary_order ${orderDirection}, unit_id ${orderDirection}
				limit ${input.limit + 1}
			), page as materialized (
				select * from accepted
				order by source_phase asc, primary_order ${orderDirection},
					secondary_order ${orderDirection}, unit_id ${orderDirection}
				limit ${input.limit}
			), continuation as (
				select
					((select count(*) from accepted) > ${input.limit}
						or (select count(*) from ordered_source) > ${input.scanLimit}) as has_more,
					case
						when (select count(*) from accepted) > ${input.limit}
							then (select primary_order from page order by source_phase desc,
								primary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								secondary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								unit_id ${source.direction === "asc" ? sql`desc` : sql`asc`} limit 1)
						when (select count(*) from ordered_source) > ${input.scanLimit}
							then (select primary_order from scanned_candidates order by source_phase desc,
								primary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								secondary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								unit_id ${source.direction === "asc" ? sql`desc` : sql`asc`} limit 1)
					end as continuation_primary,
					case
						when (select count(*) from accepted) > ${input.limit}
							then (select secondary_order from page order by source_phase desc,
								primary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								secondary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								unit_id ${source.direction === "asc" ? sql`desc` : sql`asc`} limit 1)
						when (select count(*) from ordered_source) > ${input.scanLimit}
							then (select secondary_order from scanned_candidates order by source_phase desc,
								primary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								secondary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								unit_id ${source.direction === "asc" ? sql`desc` : sql`asc`} limit 1)
					end as continuation_secondary,
					case
						when (select count(*) from accepted) > ${input.limit}
							then (select unit_id from page order by source_phase desc,
								primary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								secondary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								unit_id ${source.direction === "asc" ? sql`desc` : sql`asc`} limit 1)
						when (select count(*) from ordered_source) > ${input.scanLimit}
							then (select unit_id from scanned_candidates order by source_phase desc,
								primary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								secondary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								unit_id ${source.direction === "asc" ? sql`desc` : sql`asc`} limit 1)
					end as continuation_unit_id,
					case
						when (select count(*) from accepted) > ${input.limit}
							then (select source_name from page order by source_phase desc,
								primary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								secondary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								unit_id ${source.direction === "asc" ? sql`desc` : sql`asc`} limit 1)
						when (select count(*) from ordered_source) > ${input.scanLimit}
							then (select source_name from scanned_candidates order by source_phase desc,
								primary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								secondary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								unit_id ${source.direction === "asc" ? sql`desc` : sql`asc`} limit 1)
					end as continuation_source,
					case
						when (select count(*) from accepted) > ${input.limit}
							then (select snapshot_id from page order by source_phase desc,
								primary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								secondary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								unit_id ${source.direction === "asc" ? sql`desc` : sql`asc`} limit 1)
						when (select count(*) from ordered_source) > ${input.scanLimit}
							then (select snapshot_id from scanned_candidates order by source_phase desc,
								primary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								secondary_order ${source.direction === "asc" ? sql`desc` : sql`asc`},
								unit_id ${source.direction === "asc" ? sql`desc` : sql`asc`} limit 1)
					end as continuation_snapshot_id,
					(select count(*)::integer from scanned_candidates) as scanned_count,
					coalesce((select bool_or(search_fallback) from ordered_source), false)
						as bounded_text_fallback,
					${snapshotAvailable} as snapshot_available
			)
			select page.unit_id::text as id,
				page.primary_order::text as "primaryValue",
				page.secondary_order::text as "secondaryValue",
				page.source_name as source,
				page.snapshot_id::text as "snapshotId",
				continuation.has_more as "hasMore",
				continuation.continuation_primary::text as "continuationPrimary",
				continuation.continuation_secondary::text as "continuationSecondary",
				continuation.continuation_unit_id::text as "continuationUnitId",
				continuation.continuation_source as "continuationSource",
				continuation.continuation_snapshot_id::text as "continuationSnapshotId",
				continuation.scanned_count as "scannedCount",
				continuation.bounded_text_fallback as "boundedTextFallback",
				continuation.snapshot_available as "snapshotAvailable"
			from continuation
			left join page on true
			order by page.source_phase asc, page.primary_order ${orderDirection},
				page.secondary_order ${orderDirection},
				page.unit_id ${orderDirection}
		`);
	});
	return readSearchCandidatePage(result.rows);
}

async function resolveSparseCandidateSet(
	candidateSet: SQL | undefined,
	retainLargeCollectionSeed: boolean,
): Promise<Readonly<{ statement: SQL; materialized: boolean }> | undefined> {
	if (!candidateSet) return undefined;
	const maximumCandidates = WorkPolicy.search.maxCandidatesScanned;
	const result = await database.transaction(async (tx) => {
		await tx.execute(
			sql`select set_config('statement_timeout', ${String(boundedSearchStatementTimeout(env.SEARCH_STATEMENT_TIMEOUT_MS))}, true)`,
		);
		return tx.execute<{ id: string }>(sql`
			select candidate_seed.unit_id::text as id
			from (${candidateSet}) as candidate_seed
			limit ${maximumCandidates + 1}
		`);
	});
	if (result.rows.length > maximumCandidates)
		return retainLargeCollectionSeed ? { statement: candidateSet, materialized: false } : undefined;
	const ids = [...new Set(result.rows.map(({ id }) => id))];
	return {
		statement: sql`select bounded_seed.unit_id
			from unnest(${toUuidArray(ids)}) as bounded_seed(unit_id)`,
		materialized: true,
	};
}

async function searchCandidatePage(input: {
	readonly branches: readonly PreparedSearchBranch[];
	readonly candidateSet?: SQL;
	readonly retainLargeCollectionSeed?: boolean;
	readonly commonConditions?: readonly SQL[];
	readonly query: ExpandedSearchQuery;
	readonly sort: SearchSort;
	readonly position?: SearchKeysetPosition;
	readonly bestSnapshotId?: string | null;
	readonly limit: number;
	readonly languageBoundary: readonly ContentLanguage[];
}): Promise<SearchCandidatePage> {
	if (!input.branches.length)
		return { rows: [], hasMore: false, scannedCount: 0, boundedTextFallback: false };
	const candidateSet = await resolveSparseCandidateSet(
		input.candidateSet,
		input.retainLargeCollectionSeed === true,
	);
	const maximumScan = WorkPolicy.search.maxCandidatesScanned;
	const rows: SearchCandidateRow[] = [];
	let position = input.position;
	let scannedCount = 0;
	let scanLimit = Math.min(maximumScan, Math.max(input.limit + 1, 64));
	while (rows.length < input.limit && scannedCount < maximumScan) {
		const batch = await searchCandidateBatch({
			...input,
			candidateSet,
			position,
			limit: input.limit - rows.length,
			scanLimit: Math.min(scanLimit, maximumScan - scannedCount),
		});
		rows.push(...batch.rows);
		scannedCount += batch.scannedCount;
		if (!batch.hasMore)
			return {
				rows,
				hasMore: false,
				scannedCount,
				boundedTextFallback: batch.boundedTextFallback,
			};
		if (!batch.nextPosition)
			throw new Error("PostgreSQL Search batch omitted its keyset continuation");
		position = batch.nextPosition;
		if (rows.length >= input.limit)
			return {
				rows,
				hasMore: true,
				nextPosition: position,
				scannedCount,
				boundedTextFallback: batch.boundedTextFallback,
			};
		if (batch.boundedTextFallback)
			return {
				rows,
				hasMore: true,
				nextPosition: position,
				scannedCount,
				boundedTextFallback: true,
			};
		if (batch.scannedCount < 1) throw new Error("PostgreSQL Search batch made no keyset progress");
		scanLimit = Math.min(maximumScan - scannedCount, scanLimit * 2);
	}
	return position
		? {
				rows,
				hasMore: true,
				nextPosition: position,
				scannedCount,
				boundedTextFallback: false,
			}
		: { rows, hasMore: false, scannedCount, boundedTextFallback: false };
}

async function hydrateSearchHits(
	category: SearchCategory,
	unitIds: readonly string[],
	request: DomainSearchRequest,
	presentationLanguages: readonly ContentLanguage[],
): Promise<SearchHitWithoutSlugAddress[]> {
	if (!unitIds.length) return [];
	return database.transaction(
		async (tx) => {
			const allowed = await tx.execute<{ id: string }>(sql`select ${searchUnit.id} as id
   from unnest(${toUuidArray(unitIds)}) requested(id)
   inner join ${searchState(sql`requested.id`)} on true
   where ${getUnitReadCondition(request.profileId, { discoverableOnly: true }, searchUnit)}
   and ${getContentRatingCondition(request.contentRatingPolicy ?? DefaultContentRatingPolicy, searchUnit.contentRating)}`);
			const ids = allowed.rows.map((row) => row.id);
			const presentations = await readUnitPresentationsInTransaction(
				tx,
				ids,
				request.localizationLanguages?.length
					? request.localizationLanguages
					: presentationLanguages,
			);
			const tagPositions =
				category === "tags" && ids.length
					? await tx
							.select({
								id: tagPublicPositionStat.tagId,
								count: tagPublicPositionStat.publicPositionCount,
							})
							.from(tagPublicPositionStat)
							.where(inArray(tagPublicPositionStat.tagId, ids))
					: [];
			const positions = new Map(tagPositions.map((row) => [row.id, row.count > 1]));
			return unitIds.flatMap((id) => {
				const item = presentations.get(id);
				return item
					? [
							{
								...item,
								category,
								titles: item.title ? [item.title] : [],
								summaries: item.summary ? [item.summary] : [],
								...(category === "tags"
									? { tagHasOtherPositions: positions.get(id) ?? false }
									: {}),
							},
						]
					: [];
			});
		},
		{ isolationLevel: "repeatable read", accessMode: "read only" },
	);
}

function searchDomainScan(
	category: SearchCategory,
	request: DomainSearchRequest,
	presentation: "hits",
): Promise<SearchDomainScanResult<SearchHitWithoutSlugAddress>>;
function searchDomainScan(
	category: SearchCategory,
	request: DomainSearchRequest,
	presentation: "identifiers",
): Promise<SearchDomainScanResult<SearchIdentifier>>;
function searchDomainScan(
	category: SearchCategory,
	request: DomainSearchRequest,
	presentation: "hits",
	facetFields: readonly string[],
): Promise<
	SearchDomainScanResult<SearchHitWithoutSlugAddress> & {
		readonly facets: SearchFacet[];
	}
>;
async function searchDomainScan(
	category: SearchCategory,
	request: DomainSearchRequest,
	presentation: "hits" | "identifiers",
	facetFields?: readonly string[],
): Promise<
	| SearchDomainScanResult<SearchHitWithoutSlugAddress>
	| SearchDomainScanResult<SearchIdentifier>
	| (SearchDomainScanResult<SearchHitWithoutSlugAddress> & {
			readonly facets: SearchFacet[];
	  })
> {
	const startedAt = performance.now();
	const searchExpression = buildEffectiveSearchExpression(request);
	await authorizeSearchCollections(searchExpression, request.profileId);
	const presentationLanguages = [
		...new Set(
			[
				...(readSearchExpressionLanguageBoundary(searchExpression) ?? []),
				...(readUnitLanguageBoundary(request.domainFilter) ?? []),
			].filter(isContentLanguage),
		),
	];
	const expandedQuery = await expandSearchQuery(request.query ?? "", presentationLanguages);
	const conditions = buildSearchConditions(category, request, searchExpression);
	const sort = request.sort ?? (request.query?.trim() ? "relevance" : "best");
	const limit = request.limit ?? 20;
	const requestHash = createHash("sha256")
		.update(
			JSON.stringify({
				category,
				query: expandedQuery.query,
				queryVariants: expandedQuery.variants,
				queryExpansionPolicyVersion: expandedQuery.policyVersion,
				contentLanguageRegistryPolicy: ContentLanguageRegistryPolicy,
				limit,
				sort,
				localizationLanguages: request.localizationLanguages,
				contentRatingPolicy: contentRatingPolicyKey(
					request.contentRatingPolicy ?? DefaultContentRatingPolicy,
				),
				expression: searchExpression,
				domainFilter: request.domainFilter
					? canonicalUnitPredicate(request.domainFilter)
					: undefined,
				scopeUnitId: request.scopeUnitId,
				includeScopeDescendants: request.includeScopeDescendants,
			}),
		)
		.digest("hex");
	let cursorSeen = request.searchSeen ?? request.offset ?? 0;
	let cursorPosition: SearchKeysetPosition | undefined = request.searchPosition;
	if (request.offset && !request.cursor)
		throw new InvalidSearch("Offset pagination is not supported; use the Search cursor");
	if (request.cursor) {
		let cursor: ReturnType<typeof parseSearchCursor>;
		try {
			cursor = parseSearchCursor(request.cursor);
		} catch (cause) {
			throw new InvalidSearch(cause instanceof Error ? cause.message : "Invalid Search cursor");
		}
		if (cursor.requestHash !== requestHash || cursor.pageSize !== limit)
			throw new InvalidSearch("Search cursor does not match this request");
		const categoryState = cursor.categories[category];
		cursorSeen = categoryState?.seen ?? 0;
		cursorPosition = categoryState?.position;
	}
	const hasFacets = facetFields?.some((field) => facetSpec(category, field)) ?? false;
	const candidates = await searchCandidatePage({
		branches: [
			{
				category,
				conditions,
				sourceOwners: resolveSourceOwners(category, request.owners),
				sourceShapes: request.shapes ?? [],
			},
		],
		candidateSet: searchCandidateSet(searchExpression, request.domainFilter, request.profileId),
		retainLargeCollectionSeed: hasCollectionCandidateSet(searchExpression),
		query: expandedQuery,
		sort,
		position: cursorPosition,
		limit: hasFacets ? Math.max(limit, env.SEARCH_FACET_SCAN_LIMIT) : limit,
		languageBoundary: presentationLanguages,
	});
	const page = sliceSearchCandidatePage(candidates, limit);
	const identifiers = page.rows.map(({ id }) => ({ id }));
	const [hits, facets] = await Promise.all([
		presentation === "hits"
			? hydrateSearchHits(
					category,
					page.rows.map(({ id }) => id),
					request,
					presentationLanguages,
				)
			: Promise.resolve([]),
		hasFacets
			? aggregateDomainFacets(
					category,
					facetFields ?? [],
					candidates.rows.map(({ id }) => id),
					!candidates.hasMore,
				)
			: Promise.resolve([]),
	]);
	if (hasFacets) metrics.searchFacetScan("current", candidates.scannedCount, 1, candidates.hasMore);
	const seen = cursorSeen + page.rows.length;
	const nextPosition = page.nextPosition;
	const lowerBound = page.hasMore;
	metrics.searchCandidateScan("current", page.scannedCount, page.rows.length, 1, false, lowerBound);
	const common = {
		total: {
			kind: lowerBound ? "lower-bound" : "exact",
			value: seen,
		} as const,
		offset: cursorSeen,
		nextOffset: seen,
		exhausted: !page.hasMore,
		nextPosition,
		nextCursor: !nextPosition
			? undefined
			: createSearchCursor({
					version: SearchCursorVersion,
					requestHash,
					pageSize: limit,
					categories: {
						[category]: {
							seen,
							exhausted: false,
							position: nextPosition,
						},
					},
				}),
		limit,
		processingTimeMs: Math.round((performance.now() - startedAt) * 1000) / 1000,
	};
	return presentation === "hits"
		? { ...common, hits, ...(facetFields !== undefined ? { facets } : {}) }
		: { ...common, hits: identifiers };
}

/**
 * Executes current-state Unit search.
 *
 * @remarks
 * REZICS v1 intentionally searches only current Unit localization text and eligible Unit aliases.
 * Unit-local revision history remains available through its authoritative history APIs.
 *
 * @todo
 * Add global revision full-text search after its authorization, lifecycle, ranking,
 * deduplication, cursor, retention, capacity, backup, restore, and PGroonga reindex contracts are
 * specified and measured.
 */
export async function searchDomain(category: SearchCategory, request: DomainSearchRequest) {
	const result = await searchDomainScan(category, request, "hits");
	const slugAddresses = await getPublicCanonicalUnitSlugAddresses(result.hits.map((hit) => hit.id));
	return {
		...result,
		hits: result.hits.map((hit) => ({
			...hit,
			slugAddress: slugAddresses.get(hit.id) ?? null,
		})),
	};
}

/** @internal Resolves a grouped page and its first-page facets from one candidate window. */
export async function searchDomainWithFacets(
	category: SearchCategory,
	request: DomainSearchRequest,
	fields: readonly string[],
) {
	const { facets, ...result } = await searchDomainScan(category, request, "hits", fields);
	const slugAddresses = await getPublicCanonicalUnitSlugAddresses(result.hits.map((hit) => hit.id));
	return {
		group: {
			...result,
			hits: result.hits.map((hit) => ({
				...hit,
				slugAddress: slugAddresses.get(hit.id) ?? null,
			})),
		},
		facets,
	};
}

/** @internal Authoritative ranking and pagination without Search presentation hydration. */
export function searchDomainIdentifiers(
	category: SearchCategory,
	request: DomainSearchRequest,
): Promise<SearchDomainScanResult<SearchIdentifier>> {
	return searchDomainScan(category, request, "identifiers");
}

export interface GlobalSearchBranch {
	readonly category: SearchCategory;
	readonly searchExpression?: SearchExpression;
	/** Exact Unit roots used by the ordered source before branch predicates run. */
	readonly sourceOwners?: readonly UnitOwner[];
	readonly sourceShapes?: readonly string[];
}

export interface GlobalSearchIdentifiersRequest
	extends Omit<DomainSearchRequest, "cursor" | "searchExpression"> {
	readonly branches: readonly GlobalSearchBranch[];
	readonly cursor?: never;
	readonly position?: SearchKeysetPosition;
	/** Server-resolved initial snapshot; null pins the empty sparse projection. */
	readonly bestSnapshotId?: string | null;
	/** Server-owned predicates evaluated inside the bounded Top-K scan. */
	readonly additionalConditions?: readonly SQL[];
}

interface PreparedGlobalSearchRequest {
	readonly branches: readonly (PreparedSearchBranch & {
		readonly searchExpression?: SearchExpression;
	})[];
	readonly sort: SearchSort;
	readonly limit: number;
	readonly initialOffset: number;
	readonly languageBoundary: readonly ContentLanguage[];
	readonly query: ExpandedSearchQuery;
	readonly commonConditions: readonly SQL[];
	readonly candidateSet?: SQL;
	readonly retainLargeCollectionSeed: boolean;
}

async function prepareGlobalSearchRequest(
	request: GlobalSearchIdentifiersRequest,
): Promise<PreparedGlobalSearchRequest> {
	if (!request.branches.length) throw new InvalidSearch("Search requires at least one category");
	if (new Set(request.branches.map(({ category }) => category)).size !== request.branches.length)
		throw new InvalidSearch("Search categories must be unique");
	const { branches, additionalConditions = [], ...commonRequest } = request;
	const preparedBranches = branches.map((branch) => {
		const domainRequest = {
			...commonRequest,
			...(branch.searchExpression ? { searchExpression: branch.searchExpression } : {}),
		} satisfies DomainSearchRequest;
		const searchExpression = buildEffectiveSearchExpression(domainRequest);
		const categoryKinds: readonly UnitOwner[] = CurrentSearchOwnersByCategory[branch.category];
		const sourceOwners =
			branch.sourceOwners ?? resolveSourceOwners(branch.category, commonRequest.owners);
		if (sourceOwners.some((kind) => !categoryKinds.includes(kind)))
			throw new InvalidSearch("Global Search branch has a Unit kind outside its category");
		return {
			category: branch.category,
			sourceOwners,
			sourceShapes: branch.sourceShapes ?? commonRequest.shapes ?? [],
			conditions: buildSearchConditions(branch.category, domainRequest, searchExpression, false),
			...(searchExpression ? { searchExpression } : {}),
		};
	});
	await authorizeSearchCollections(
		combineSearchExpressions(
			"any",
			preparedBranches.flatMap(({ searchExpression }) =>
				searchExpression ? [searchExpression] : [],
			),
		),
		request.profileId,
	);
	const branchCandidateSets = preparedBranches.map(({ searchExpression }) =>
		searchExpression ? compileSearchExpressionCandidateSet(searchExpression) : undefined,
	);
	const expressionCandidateSet = branchCandidateSets.every(
		(candidate): candidate is SQL => candidate !== undefined,
	)
		? combineCandidateSets("union", branchCandidateSets)
		: undefined;
	const candidateSet = combineCandidateSets(
		"intersect",
		[
			expressionCandidateSet,
			request.domainFilter
				? compileUnitPredicateCandidateSet(request.domainFilter, request.profileId)
				: undefined,
		].filter((candidate): candidate is SQL => candidate !== undefined),
	);
	const languageBoundary = [
		...new Set(
			[
				...preparedBranches.flatMap(
					({ searchExpression }) => readSearchExpressionLanguageBoundary(searchExpression) ?? [],
				),
				...(readUnitLanguageBoundary(request.domainFilter) ?? []),
			].filter(isContentLanguage),
		),
	];
	return {
		branches: preparedBranches,
		sort: request.sort ?? (request.query?.trim() ? "relevance" : "best"),
		limit: request.limit ?? 20,
		initialOffset: request.offset ?? 0,
		commonConditions: [...buildCommonSearchConditions(commonRequest), ...additionalConditions],
		...(candidateSet ? { candidateSet } : {}),
		retainLargeCollectionSeed: expressionCandidateSet !== undefined,
		languageBoundary,
		query: await expandSearchQuery(request.query ?? "", languageBoundary),
	};
}

function sliceSearchCandidatePage(window: SearchCandidatePage, limit: number): SearchCandidatePage {
	if (window.rows.length <= limit) return window;
	const rows = window.rows.slice(0, limit);
	const last = rows.at(-1);
	if (!last) throw new Error("Search candidate window could not produce a page cursor");
	return {
		rows,
		hasMore: true,
		nextPosition: last.position,
		scannedCount: window.scannedCount,
		boundedTextFallback: window.boundedTextFallback,
	};
}

function globalIdentifierResult(
	page: SearchCandidatePage,
	limit: number,
	initialOffset: number,
	startedAt: number,
): SearchDomainScanResult<SearchIdentifier> {
	const identifiers = page.rows.map(({ id }) => ({ id }));
	const nextOffset = initialOffset + identifiers.length;
	metrics.searchCandidateScan(
		"current",
		page.scannedCount,
		identifiers.length,
		1,
		false,
		page.hasMore,
	);
	return {
		hits: identifiers,
		total: {
			kind: page.hasMore ? "lower-bound" : "exact",
			value: nextOffset,
		},
		offset: initialOffset,
		nextOffset,
		exhausted: !page.hasMore,
		nextPosition: page.nextPosition,
		limit,
		processingTimeMs: Math.round((performance.now() - startedAt) * 1000) / 1000,
	};
}

/**
 * Executes one globally sorted authoritative stream across mutually exclusive categories.
 *
 * @internal
 */
export async function searchGlobalIdentifiers(
	request: GlobalSearchIdentifiersRequest,
): Promise<SearchDomainScanResult<SearchIdentifier>> {
	const startedAt = performance.now();
	const prepared = await prepareGlobalSearchRequest(request);
	const page = await searchCandidatePage({
		branches: prepared.branches,
		candidateSet: prepared.candidateSet,
		retainLargeCollectionSeed: prepared.retainLargeCollectionSeed,
		commonConditions: prepared.commonConditions,
		query: prepared.query,
		sort: prepared.sort,
		position: request.position,
		bestSnapshotId: request.bestSnapshotId,
		limit: prepared.limit,
		languageBoundary: prepared.languageBoundary,
	});
	return globalIdentifierResult(page, prepared.limit, prepared.initialOffset, startedAt);
}

export interface SearchFacet {
	readonly field: string;
	readonly options: readonly {
		readonly value: string;
		readonly count: SearchCountResult;
	}[];
}

function isSearchField(value: string): value is SearchField {
	return SearchFieldValues.some((field) => field === value);
}

function facetSpec(
	category: SearchCategory,
	field: string,
): { readonly value: SQL; readonly join: SQL } | undefined {
	if (
		!isSearchField(field) ||
		!supportsCurrentSearchField(category, field) ||
		getCurrentSearchFieldDefinition(field).facet === "none"
	)
		return undefined;
	const none = sql``;
	if (field === "category") return { value: sql`${category}::text`, join: none };
	if (field === "language")
		return {
			value: sql`facet_language.language`,
			join: sql`join lateral (
				select language from ${unitLocalization} where unit_id=${searchUnit.id}
				union select language from unnest(array['zh','en','ja','ko','de','fr','es']::text[]) native_language(language)
				where public.catalog_name_has_languages(${searchUnit.id},array[language],false)
			) facet_language on true`,
		};
	if (field === "tag")
		return {
			value: sql`${facetUnitTag.tagId}`,
			join: sql`join ${unitEffectiveTag} as ${facetUnitTag}
				on ${facetUnitTag.unitId} = ${searchUnit.id}`,
		};
	if (field === "realm")
		return {
			value: sql`${facetRealmUnit.realmId}`,
			join: sql`join ${realmUnit} as ${facetRealmUnit}
				on ${facetRealmUnit.unitId} = ${searchUnit.id} and ${facetRealmUnit.status} = 'visible'`,
		};
	if (field === "credit")
		return {
			value: sql`${facetCreditAttribution.creditedEntityId}`,
			join: sql`join ${creditAttribution} as ${facetCreditAttribution}
				on ${facetCreditAttribution.sourceUnitId} = ${searchUnit.id}`,
		};
	if (field === "owner")
		return {
			value: sql`${facetOwnership.profileId}`,
			join: sql`join ${unitOwnership} as ${facetOwnership}
				on ${facetOwnership.unitId} = ${searchUnit.id}
				and ${facetOwnership.revokedAt} is null`,
		};
	if (field === "license")
		return {
			value: sql`${facetLicenseGrant.licenseId}`,
			join: sql`join ${unitLicenseGrant} as ${facetLicenseGrant}
				on ${facetLicenseGrant.unitId} = ${searchUnit.id}
				and ${facetLicenseGrant.offeringEndedAt} is null
				and ${facetLicenseGrant.recognitionStatus} = 'recognized'`,
		};
	if (field === "unit-owner") return { value: sql`${searchUnit.owner}`, join: none };
	if (field === "unit-shape") return { value: sql`${searchUnit.shape}`, join: none };

	const scalar: Partial<Record<SearchField, SQL>> = {
		"content-rating": sql`${searchUnit.contentRating}`,
		"ai-disclosure": sql`${searchUnit.aiDisclosure}`,
		"join-policy": sql`(select ${realm.joinPolicy} from ${realm} where ${realm.id} = ${searchUnit.id})`,
		multiple: sql`(select ${poll.mode} = 'multiple' from ${poll} where ${poll.id} = ${searchUnit.id})`,
		"results-visibility": sql`(select ${poll.resultVisibility}
			from ${poll} where ${poll.id} = ${searchUnit.id})`,
		closed: sql`(select ${poll.closedAt} is not null or ${poll.closesAt} <= now()
			from ${poll} where ${poll.id} = ${searchUnit.id})`,
	};
	const value = scalar[field];
	return value ? { value, join: none } : undefined;
}

async function aggregateDomainFacets(
	category: SearchCategory,
	fields: readonly string[],
	candidateIds: readonly string[],
	exhausted: boolean,
): Promise<SearchFacet[]> {
	const requestedFacets = fields.flatMap((field) => {
		const spec = facetSpec(category, field);
		return spec ? [{ field, spec }] : [];
	});
	if (!requestedFacets.length || !candidateIds.length) return [];
	const queries = requestedFacets.map(
		({ field, spec }) => sql`(
			select ${field}::text as field, (${spec.value})::text as value,
				count(distinct ${searchUnit.id})::text as count
			from search_candidate
			inner join ${searchState(sql`search_candidate.unit_id`)} on true
			${spec.join}
			where (${spec.value}) is not null
			group by (${spec.value})
			order by count(distinct ${searchUnit.id}) desc, (${spec.value})::text
			limit 100
		)`,
	);
	const result = await database.execute<{ field: string; value: string; count: string }>(
		sql`with search_candidate(unit_id) as (
			select * from unnest(${toUuidArray(candidateIds)})
		)
		${sql.join(queries, sql` union all `)}`,
	);
	const byField = new Map<string, { value: string; count: SearchCountResult }[]>();
	for (const row of result.rows) {
		const options = byField.get(row.field) ?? [];
		options.push({
			value: row.value,
			count: { kind: exhausted ? "exact" : "lower-bound", value: Number(row.count) },
		});
		byField.set(row.field, options);
	}
	return fields.flatMap((field) => {
		const options = byField.get(field);
		return options ? [{ field, options }] : [];
	});
}

/** Conjunctive facet counts for the effective configured request, batched per category. */
export async function searchDomainFacets(
	category: SearchCategory,
	request: DomainSearchRequest,
	fields: readonly string[],
): Promise<SearchFacet[]> {
	if (!fields.length) return [];
	const searchExpression = buildEffectiveSearchExpression(request);
	await authorizeSearchCollections(searchExpression, request.profileId);
	const conditions = buildSearchConditions(category, request, searchExpression);
	const candidateLimit = env.SEARCH_FACET_SCAN_LIMIT;
	const languageBoundary = [
		...new Set(
			[
				...(readSearchExpressionLanguageBoundary(searchExpression) ?? []),
				...(readUnitLanguageBoundary(request.domainFilter) ?? []),
			].filter(isContentLanguage),
		),
	];
	const expandedQuery = await expandSearchQuery(request.query ?? "", languageBoundary);
	const candidates = await searchCandidatePage({
		branches: [
			{
				category,
				conditions,
				sourceOwners: resolveSourceOwners(category, request.owners),
				sourceShapes: request.shapes ?? [],
			},
		],
		candidateSet: searchCandidateSet(searchExpression, request.domainFilter, request.profileId),
		retainLargeCollectionSeed: hasCollectionCandidateSet(searchExpression),
		query: expandedQuery,
		sort: request.sort ?? (request.query?.trim() ? "relevance" : "best"),
		limit: candidateLimit,
		languageBoundary,
	});
	const exhausted = !candidates.hasMore;
	metrics.searchFacetScan("current", candidates.rows.length, 1, !exhausted);
	return aggregateDomainFacets(
		category,
		fields,
		candidates.rows.map(({ id }) => id),
		exhausted,
	);
}

/**
 * Computes every global facet group from one bounded ranked candidate stream.
 *
 * Category predicates are rechecked against the bounded UUID set so facet
 * semantics remain category-specific without rerunning candidate generation.
 */
interface PreparedGlobalFacetBranch extends PreparedSearchBranch {
	readonly fields: readonly string[];
}

async function aggregateGlobalFacets(
	preparedBranches: readonly PreparedGlobalFacetBranch[],
	candidateIds: readonly string[],
	exhausted: boolean,
): Promise<readonly { readonly category: SearchCategory; readonly facets: SearchFacet[] }[]> {
	const requestedFacets = preparedBranches.flatMap((branch) =>
		branch.fields.flatMap((field) => {
			const spec = facetSpec(branch.category, field);
			return spec ? [{ ...branch, field, spec }] : [];
		}),
	);
	if (!requestedFacets.length) return [];
	if (!candidateIds.length)
		return preparedBranches.map(({ category }) => ({ category, facets: [] }));
	const eligibilityRows = preparedBranches.map(
		({ category, conditions }) =>
			sql`(${category}::text, (${sql.join([...conditions], sql` and `)}))`,
	);
	const queries = requestedFacets.map(
		({ category, field, spec }) => sql`(
			select ${category}::text as category, ${field}::text as field,
				(${spec.value})::text as value,
				count(distinct ${searchUnit.id})::text as count
			from eligible_category
			inner join ${searchState(sql`eligible_category.unit_id`)} on true
			${spec.join}
			where eligible_category.category = ${category}::text
				and (${spec.value}) is not null
			group by (${spec.value})
			order by count(distinct ${searchUnit.id}) desc, (${spec.value})::text
			limit 100
		)`,
	);
	const result = await database.execute<{
		category: SearchCategory;
		field: string;
		value: string;
		count: string;
	}>(sql`with search_candidate(unit_id) as (
		select * from unnest(${toUuidArray(candidateIds)})
	), eligible_category(unit_id, category) as materialized (
		select ${searchUnit.id}, eligibility.category
		from search_candidate
		inner join ${searchState(sql`search_candidate.unit_id`)} on true
		cross join lateral (values ${sql.join(eligibilityRows, sql`, `)})
			as eligibility(category, matches)
		where eligibility.matches
	)
	${sql.join(queries, sql` union all `)}`);
	const optionsByCategoryField = new Map<string, { value: string; count: SearchCountResult }[]>();
	for (const row of result.rows) {
		const key = `${row.category}:${row.field}`;
		const options = optionsByCategoryField.get(key) ?? [];
		options.push({
			value: row.value,
			count: { kind: exhausted ? "exact" : "lower-bound", value: Number(row.count) },
		});
		optionsByCategoryField.set(key, options);
	}
	return preparedBranches.map(({ category, fields }) => ({
		category,
		facets: fields.flatMap((field) => {
			const options = optionsByCategoryField.get(`${category}:${field}`);
			return options ? [{ field, options }] : [];
		}),
	}));
}

export async function searchGlobalFacets(
	branches: readonly {
		readonly category: SearchCategory;
		readonly request: DomainSearchRequest;
		readonly fields: readonly string[];
	}[],
): Promise<readonly { readonly category: SearchCategory; readonly facets: SearchFacet[] }[]> {
	if (!branches.length || branches.every(({ fields }) => !fields.length)) return [];
	const preparedBranches = branches.map(({ category, request, fields }) => {
		const searchExpression = buildEffectiveSearchExpression(request);
		return {
			category,
			request,
			fields,
			searchExpression,
			sourceOwners: resolveSourceOwners(category, request.owners),
			sourceShapes: request.shapes ?? [],
			conditions: buildSearchConditions(category, request, searchExpression),
		};
	});
	const first = preparedBranches[0];
	if (!first) return [];
	if (preparedBranches.some(({ request }) => request.profileId !== first.request.profileId))
		throw new InvalidSearch("Global Search facet branches must share one viewer");
	await authorizeSearchCollections(
		combineSearchExpressions(
			"any",
			preparedBranches.flatMap(({ searchExpression }) =>
				searchExpression ? [searchExpression] : [],
			),
		),
		first.request.profileId,
	);
	if (
		!preparedBranches.some((branch) =>
			branch.fields.some((field) => facetSpec(branch.category, field)),
		)
	)
		return [];
	const languageBoundary = [
		...new Set(
			[
				...preparedBranches.flatMap(
					({ searchExpression }) => readSearchExpressionLanguageBoundary(searchExpression) ?? [],
				),
				...(readUnitLanguageBoundary(first.request.domainFilter) ?? []),
			].filter(isContentLanguage),
		),
	];
	const expandedQuery = await expandSearchQuery(first.request.query ?? "", languageBoundary);
	const candidates = await searchCandidatePage({
		branches: preparedBranches,
		candidateSet: preparedBranches.every(
			({ searchExpression, request }) =>
				searchCandidateSet(searchExpression, request.domainFilter, request.profileId) !== undefined,
		)
			? combineCandidateSets(
					"union",
					preparedBranches.flatMap(({ searchExpression, request }) => {
						const candidate = searchCandidateSet(
							searchExpression,
							request.domainFilter,
							request.profileId,
						);
						return candidate ? [candidate] : [];
					}),
				)
			: undefined,
		retainLargeCollectionSeed: preparedBranches.every(({ searchExpression }) =>
			hasCollectionCandidateSet(searchExpression),
		),
		query: expandedQuery,
		sort: first.request.sort ?? (first.request.query?.trim() ? "relevance" : "best"),
		limit: env.SEARCH_FACET_SCAN_LIMIT,
		languageBoundary,
	});
	const exhausted = !candidates.hasMore;
	metrics.searchFacetScan("current", candidates.scannedCount, 1, !exhausted);
	return aggregateGlobalFacets(
		preparedBranches,
		candidates.rows.map(({ id }) => id),
		exhausted,
	);
}

/**
 * Resolves the global page and first-page facets from one ranked candidate window.
 * The page cursor is cut at the final returned hit even when the shared window is wider.
 */
export async function searchGlobalIdentifiersWithFacets(
	request: GlobalSearchIdentifiersRequest,
	facetFields: readonly {
		readonly category: SearchCategory;
		readonly fields: readonly string[];
	}[],
): Promise<{
	readonly page: SearchDomainScanResult<SearchIdentifier>;
	readonly facetGroups: readonly {
		readonly category: SearchCategory;
		readonly facets: SearchFacet[];
	}[];
}> {
	const startedAt = performance.now();
	const prepared = await prepareGlobalSearchRequest(request);
	const fieldsByCategory = new Map(
		facetFields.map(({ category, fields }) => [category, fields] as const),
	);
	const facetBranches: PreparedGlobalFacetBranch[] = prepared.branches.map((branch) => ({
		...branch,
		fields: fieldsByCategory.get(branch.category) ?? [],
	}));
	const hasFacets = facetBranches.some((branch) =>
		branch.fields.some((field) => facetSpec(branch.category, field)),
	);
	const candidates = await searchCandidatePage({
		branches: prepared.branches,
		candidateSet: prepared.candidateSet,
		retainLargeCollectionSeed: prepared.retainLargeCollectionSeed,
		commonConditions: prepared.commonConditions,
		query: prepared.query,
		sort: prepared.sort,
		position: request.position,
		limit: hasFacets ? Math.max(prepared.limit, env.SEARCH_FACET_SCAN_LIMIT) : prepared.limit,
		languageBoundary: prepared.languageBoundary,
	});
	const page = globalIdentifierResult(
		sliceSearchCandidatePage(candidates, prepared.limit),
		prepared.limit,
		prepared.initialOffset,
		startedAt,
	);
	if (!hasFacets) return { page, facetGroups: [] };
	metrics.searchFacetScan("current", candidates.scannedCount, 1, candidates.hasMore);
	return {
		page,
		facetGroups: await aggregateGlobalFacets(
			facetBranches,
			candidates.rows.map(({ id }) => id),
			!candidates.hasMore,
		),
	};
}

export async function searchGrouped(request: {
	profileId?: string;
	query?: string;
	indexes: SearchCategory[];
	localizationLanguages: readonly ContentLanguage[];
	Languages?: ContentLanguage[];
	owners?: UnitOwner[];
	shapes?: string[];
	limitPerIndex?: number;
	contentRatingPolicy?: DomainSearchRequest["contentRatingPolicy"];
}) {
	const groups = await Promise.all(
		request.indexes.map(async (category) => {
			const result = await searchDomain(category, {
				profileId: request.profileId,
				query: request.query,
				localizationLanguages: request.localizationLanguages,
				Languages: request.Languages,
				owners: request.owners,
				shapes: request.shapes,
				limit: request.limitPerIndex ?? 5,
				contentRatingPolicy: request.contentRatingPolicy,
			});
			return { index: category, ...result };
		}),
	);
	return { query: request.query ?? "", groups };
}
