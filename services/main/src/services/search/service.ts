import { createHash } from "node:crypto";

import { and, eq, exists, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
	readUnitLanguageBoundary,
	type SearchControlPredicate,
	type SearchField,
	SearchFieldValues,
	type SearchScalarField,
	type SearchScalar,
} from "@rezics/filter";
import { canonicalUnitPredicate } from "@rezics/filter";
import { isContentLanguage, type ContentLanguage } from "@rezics/i18n";
import { getActiveObservability } from "@rezics/observability";

import { getUnitReadCondition } from "../authorization/unit/query";
import {
	DefaultContentRatingPolicy,
	getContentRatingCondition,
	contentRatingPolicyKey,
} from "../content-rating/policy";
import { database } from "../database";
import {
	book,
	unitContentLicense,
	creditAttribution,
	contentStructure,
	contentStructureNode,
	entity,
	media,
	poll,
	post,
	postReply,
	postReplyStat,
	unitFollowStat,
	realm,
	realmTagContext,
	realmTagVoteStat,
	realmUnit,
	software,
	softwareRequirement,
	recommendationSnapshot,
	unitBestScore,
	unitSearchDocument,
	unit,
	unitOwnership,
	unitLocalization,
	unitEffectiveTag,
	unitStructureMember,
	unitStructureVoteStat,
	unitVariant,
	type UnitKind,
	UnitKindValues,
	VariantCapableUnitKindValues,
} from "../database/schema";
import { env } from "../config";
import { WorkPolicy } from "../performance/policy";
import type { SearchCountResult } from "../counts/contract";
import {
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
} from "../units/localization";
import { InvalidSearch } from "./errors";
import { CurrentSearchUnitKindsByCategory } from "./contracts";
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
	type SearchKeysetPosition,
	type SearchExpression,
} from "./query";
import {
	SearchFieldByDomainRequestFilter,
	type DomainSearchRequest,
	type SearchCategory,
	type SearchHit,
	type SearchSort,
} from "./schema";
import { expandSearchQuery, type ExpandedSearchQuery } from "./query-expansion";
import { getPublicCanonicalUnitSlugAddresses } from "../units/slug-address";
import { compileUnitPredicateCandidateSet, compileUnitPredicateSql } from "../filter/sql";

const subjectUnit = alias(unit, "subject_unit");
const boundedSearchDocument = alias(unitSearchDocument, "bounded_search_document");
const facetLocalization = alias(unitLocalization, "facet_unit_localization");
const facetUnitTag = alias(unitEffectiveTag, "facet_unit_tag");
const facetRealmUnit = alias(realmUnit, "facet_realm_unit");
const facetCreditAttribution = alias(creditAttribution, "facet_credit_attribution");
const facetOwnership = alias(unitOwnership, "facet_ownership");
const scopedRealmTagContextRealm = alias(realm, "scoped_realm_tag_context_realm");
const scopedRealmTagContextPostUnit = alias(unit, "scoped_realm_tag_context_post_unit");
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
		["kinds", SearchFieldByDomainRequestFilter.kind, Boolean(request.kinds?.length)],
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
			"contentLicenseActive",
			SearchFieldByDomainRequestFilter.contentLicenseActive,
			request.contentLicenseActive !== undefined,
		],
		[
			"creditedUnitId",
			SearchFieldByDomainRequestFilter.creditedUnitId,
			Boolean(request.creditedUnitId),
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

function numericColumnCondition(column: SQL, filter: SearchControlPredicate): SQL {
	if (filter.operator === "exists")
		return filter.value ? sql`${column} is not null` : sql`${column} is null`;
	if (filter.operator !== "range")
		throw new InvalidSearch(`${filter.field} requires a numeric range`);
	const bounds: SQL[] = [];
	if (filter.lower !== undefined) {
		if (typeof filter.lower !== "number")
			throw new InvalidSearch(`${filter.field} requires numeric bounds`);
		bounds.push(sql`${column} >= ${filter.lower}`);
	}
	if (filter.upper !== undefined) {
		if (typeof filter.upper !== "number")
			throw new InvalidSearch(`${filter.field} requires numeric bounds`);
		bounds.push(sql`${column} <= ${filter.upper}`);
	}
	return sql`(${sql.join(bounds, sql` and `)})`;
}

function booleanColumnCondition(column: SQL, filter: SearchControlPredicate): SQL {
	if (!("value" in filter) || typeof filter.value !== "boolean")
		throw new InvalidSearch(`${filter.field} requires a boolean value`);
	const match = sql`${column} = ${filter.value}`;
	return filter.operator === "not-equals" ? sql`not (${match})` : match;
}

function softwareRequirementCondition(filter: SearchControlPredicate, column: SQL): SQL {
	const values = scalarStrings(searchFilterValues(filter), filter.field);
	const candidates =
		filter.field === "software-platform" ? toUuidArray(values) : toTextArray(values);
	const oneMatches = sql`exists (
		select 1 from ${softwareRequirement}
		where ${softwareRequirement.softwareId} = ${unit.id}
			and ${column} = any(${candidates})
	)`;
	if (filter.operator === "all-of")
		return sql`not exists (
			select 1 from unnest(${candidates}) as required(value)
			where not exists (
				select 1 from ${softwareRequirement}
				where ${softwareRequirement.softwareId} = ${unit.id}
					and ${column} = required.value
			)
		)`;
	return filter.operator === "not-equals" || filter.operator === "none-of"
		? sql`not (${oneMatches})`
		: oneMatches;
}

function softwareRequirementRowCondition(filter: SearchControlPredicate, column: SQL): SQL {
	const values = scalarStrings(searchFilterValues(filter), filter.field);
	const candidates =
		filter.field === "software-platform" ? toUuidArray(values) : toTextArray(values);
	if (filter.operator === "all-of" && values.length > 1) return sql`false`;
	const matches = sql`${column} = any(${candidates})`;
	return filter.operator === "not-equals" || filter.operator === "none-of"
		? sql`not (${matches})`
		: matches;
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
			inner join ${unit} as ${scopedRealmTagContextPostUnit}
				on ${scopedRealmTagContextPostUnit.id} = ${realmTagContext.contextPostId}
			where ${realmTagContext.tagId} = ${unit.id}
				and ${realmTagContext.realmId} = ${filter.value}::uuid
				and ${scopedRealmTagContextRealm.realmTagVotingEnabled} = true
				and ${scopedRealmTagContextRealmUnit.status} = 'visible'
				and ${scopedRealmTagContextRealmUnit.publicationState} = 'active'
				and ${getUnitReadCondition(profileId, {}, scopedRealmTagContextPostUnit)}
		)`;
	}
	if (filter.field === "realm-tag-vote") {
		const conditions: SQL[] = [
			sql`${realmTagVoteStat.unitId} = ${unit.id}`,
			sql`${realmTagVoteStat.realmId} = ${filter.realmId}::uuid`,
			sql`${realmTagVoteStat.tagId} = ${filter.tagId}::uuid`,
		];
		const addBounds = (
			column: SQL,
			range: { readonly lower?: number; readonly upper?: number } | undefined,
		) => {
			if (range?.lower !== undefined) conditions.push(sql`${column} >= ${range.lower}`);
			if (range?.upper !== undefined) conditions.push(sql`${column} <= ${range.upper}`);
		};
		addBounds(sql`${realmTagVoteStat.score}`, filter.score);
		addBounds(sql`${realmTagVoteStat.voteCount}`, filter.voteCount);
		return sql`exists (
			select 1
			from ${realmTagVoteStat}
			where ${sql.join(conditions, sql` and `)}
		)`;
	}
	if (filter.field === "category") {
		const values = scalarStrings(searchFilterValues(filter), filter.field);
		const matches = values.includes(category);
		if (filter.operator === "not-equals" || filter.operator === "none-of") return sql`${!matches}`;
		return sql`${matches}`;
	}
	if (filter.field === "content-license") {
		const condition = and(
			inArray(unit.kind, VariantCapableUnitKindValues),
			booleanColumnCondition(
				exists(
					database
						.select({ unitId: unitContentLicense.unitId })
						.from(unitContentLicense)
						.where(
							and(eq(unitContentLicense.unitId, unit.id), eq(unitContentLicense.status, "active")),
						),
				),
				filter,
			),
		);
		if (!condition) throw new Error("Unit content License filter produced no SQL condition");
		return condition;
	}
	const typeSpecificScalar: Partial<
		Record<
			SearchControlPredicate["field"],
			{
				readonly kind: string;
				readonly relation: SQL;
				readonly id: SQL;
				readonly column: SQL;
			}
		>
	> = {
		"book-isbn13": {
			kind: "book",
			relation: sql`${book}`,
			id: sql`${book.id}`,
			column: sql`${book.isbn13}`,
		},
		"book-publication-date": {
			kind: "book",
			relation: sql`${book}`,
			id: sql`${book.id}`,
			column: sql`${book.publicationDate}`,
		},
		"book-format": {
			kind: "book",
			relation: sql`${book}`,
			id: sql`${book.id}`,
			column: sql`${book.format}`,
		},
		"media-kind": {
			kind: "media",
			relation: sql`${media}`,
			id: sql`${media.id}`,
			column: sql`${media.kind}`,
		},
		"media-release-date": {
			kind: "media",
			relation: sql`${media}`,
			id: sql`${media.id}`,
			column: sql`${media.releaseDate}`,
		},
		"software-release-date": {
			kind: "software",
			relation: sql`${software}`,
			id: sql`${software.id}`,
			column: sql`${software.releaseDate}`,
		},
		"software-version-label": {
			kind: "software",
			relation: sql`${software}`,
			id: sql`${software.id}`,
			column: sql`${software.versionLabel}`,
		},
	};
	const scalarDefinition = typeSpecificScalar[filter.field];
	if (scalarDefinition)
		return sql`${unit.kind}::text = ${scalarDefinition.kind} and exists (
			select 1 from ${scalarDefinition.relation}
			where ${scalarDefinition.id} = ${unit.id}
				and ${scalarColumnCondition(scalarDefinition.column, filter)}
		)`;
	const typeSpecificNumeric: Partial<
		Record<
			SearchControlPredicate["field"],
			{
				readonly kind: string;
				readonly relation: SQL;
				readonly id: SQL;
				readonly column: SQL;
			}
		>
	> = {
		"book-page-count": {
			kind: "book",
			relation: sql`${book}`,
			id: sql`${book.id}`,
			column: sql`${book.pageCount}`,
		},
		"book-word-count": {
			kind: "book",
			relation: sql`${book}`,
			id: sql`${book.id}`,
			column: sql`${book.wordCount}`,
		},
		"media-runtime-minutes": {
			kind: "media",
			relation: sql`${media}`,
			id: sql`${media.id}`,
			column: sql`${media.runtimeMinutes}`,
		},
		"media-episode-count": {
			kind: "media",
			relation: sql`${media}`,
			id: sql`${media.id}`,
			column: sql`${media.episodeCount}`,
		},
		"media-season-count": {
			kind: "media",
			relation: sql`${media}`,
			id: sql`${media.id}`,
			column: sql`${media.seasonCount}`,
		},
	};
	const numericDefinition = typeSpecificNumeric[filter.field];
	if (numericDefinition)
		return sql`${unit.kind}::text = ${numericDefinition.kind} and exists (
			select 1 from ${numericDefinition.relation}
			where ${numericDefinition.id} = ${unit.id}
				and ${numericColumnCondition(numericDefinition.column, filter)}
		)`;
	if (filter.field === "software-platform")
		return sql`${unit.kind} = 'software' and ${softwareRequirementCondition(
			filter,
			sql`${softwareRequirement.platformEntityId}`,
		)}`;
	if (filter.field === "software-requirement-tier")
		return sql`${unit.kind} = 'software' and ${softwareRequirementCondition(
			filter,
			sql`${softwareRequirement.tier}`,
		)}`;

	if (filter.field === "language") {
		const values = scalarStrings(searchFilterValues(filter), filter.field);
		const match =
			filter.operator === "all-of"
				? sql`array(
					select ${unitLocalization.language}
					from ${unitLocalization}
					where ${unitLocalization.unitId} = ${unit.id}
				) @> ${toTextArray(values)}`
				: sql`exists (
					select 1 from ${unitLocalization}
					where ${unitLocalization.unitId} = ${unit.id}
						and ${unitLocalization.language} = any(${toTextArray(values)})
				)`;
		return filter.operator === "not-equals" || filter.operator === "none-of"
			? sql`not (${match})`
			: match;
	}
	if (filter.field === "credit") {
		const creditedUnits = sql`array(
			select distinct ${creditAttribution.creditedUnitId}
			from ${creditAttribution}
			where ${creditAttribution.sourceUnitId} = ${unit.id}
		)`;
		if (filter.operator === "exists")
			return filter.value
				? sql`cardinality(${creditedUnits}) > 0`
				: sql`cardinality(${creditedUnits}) = 0`;
		const values = scalarStrings(searchFilterValues(filter), filter.field);
		const match =
			filter.operator === "all-of"
				? sql`${creditedUnits} @> ${toUuidArray(values)}`
				: sql`${creditedUnits} && ${toUuidArray(values)}`;
		return filter.operator === "not-equals" || filter.operator === "none-of"
			? sql`not (${match})`
			: match;
	}
	if (filter.field === "credited-profile") {
		const creditedProfiles = sql`array(
			select resolved_credit.profile_id
			from (
				select direct_credit.credited_unit_id as profile_id
				from public.credit_attribution as direct_credit
				join public.unit as direct_profile
					on direct_profile.id = direct_credit.credited_unit_id
					and direct_profile.kind = 'profile'
					and direct_profile.status = 'published'
					and direct_profile.visibility <> 'private'
					and direct_profile.moderation_status = 'approved'
					and direct_profile.deleted_at is null
				where direct_credit.source_unit_id = ${unit.id}
				union
				select entity_profile.credited_unit_id as profile_id
				from public.credit_attribution as source_credit
				join public.unit as credited_entity
					on credited_entity.id = source_credit.credited_unit_id
					and credited_entity.kind = 'entity'
					and credited_entity.status = 'published'
					and credited_entity.visibility <> 'private'
					and credited_entity.moderation_status = 'approved'
					and credited_entity.deleted_at is null
				join public.credit_attribution as entity_profile
					on entity_profile.source_unit_id = credited_entity.id
					and entity_profile.role = 'publisher'
				join public.unit as credited_profile
					on credited_profile.id = entity_profile.credited_unit_id
					and credited_profile.kind = 'profile'
					and credited_profile.status = 'published'
					and credited_profile.visibility <> 'private'
					and credited_profile.moderation_status = 'approved'
					and credited_profile.deleted_at is null
				where source_credit.source_unit_id = ${unit.id}
			) as resolved_credit
		)`;
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
			where ${contentStructureNode.contentUnitId} = ${unit.id}
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
			where ${unitOwnership.unitId} = ${unit.id}
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
					where ${unitEffectiveTag.unitId} = ${unit.id}
				) @> ${toUuidArray(values)}`
				: sql`exists (
					select 1 from ${unitEffectiveTag}
					where ${unitEffectiveTag.unitId} = ${unit.id}
						and ${unitEffectiveTag.tagId} = any(${toUuidArray(values)})
				)`;
		return filter.operator === "not-equals" || filter.operator === "none-of"
			? sql`not (${match})`
			: match;
	}
	if (filter.field === "realm") {
		const values = scalarStrings(searchFilterValues(filter), filter.field);
		const match =
			filter.operator === "all-of"
				? sql`array(
					select ${realmUnit.realmId}
					from ${realmUnit}
					where ${realmUnit.unitId} = ${unit.id}
						and ${realmUnit.status} = 'visible'
						and ${realmUnit.publicationState} = 'active'
				) @> ${toUuidArray(values)}`
				: sql`exists (
					select 1 from ${realmUnit}
					where ${realmUnit.unitId} = ${unit.id}
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
			where ${poll.id} = ${unit.id} and ${condition}
		)`;
	}

	if (filter.field === "kind") {
		if (category === "entities")
			return sql`exists (
				select 1 from ${entity}
				where ${entity.id} = ${unit.id}
					and ${scalarColumnCondition(sql`${entity.kind}`, filter)}
			)`;
		if (category === "posts")
			return sql`exists (
				select 1 from ${post}
				where ${post.id} = ${unit.id}
					and ${scalarColumnCondition(sql`${post.kind}`, filter)}
			)`;
		if (category === "reviews")
			return sql`exists (
				select 1 from ${post}
				inner join ${unit} as ${subjectUnit} on ${subjectUnit.id} = ${post.subjectUnitId}
				where ${post.id} = ${unit.id}
					and ${scalarColumnCondition(sql`${subjectUnit.kind}`, filter)}
			)`;
		return scalarColumnCondition(sql`${unit.kind}`, filter);
	}

	const directUnitColumnByField: Partial<Record<SearchControlPredicate["field"], SQL>> = {
		"content-rating": sql`${unit.contentRating}`,
		"ai-disclosure": sql`${unit.aiDisclosure}`,
		license: sql`${unit.license}`,
		"created-at": sql`${unit.createdAt}`,
		"updated-at": sql`${unit.updatedAt}`,
		"published-at": sql`${unit.publishedAt}`,
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
		where ${oneToOneColumn.id} = ${unit.id}
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
	if (expression.operator === "all") {
		const requirementFilters = expression.clauses.filter(
			(clause): clause is SearchControlPredicate =>
				"field" in clause &&
				(clause.field === "software-platform" || clause.field === "software-requirement-tier"),
		);
		if (
			requirementFilters.some((filter) => filter.field === "software-platform") &&
			requirementFilters.some((filter) => filter.field === "software-requirement-tier")
		) {
			const requirementClauses = new Set<SearchExpression>(requirementFilters);
			const requirementConditions = requirementFilters.map((filter) =>
				softwareRequirementRowCondition(
					filter,
					filter.field === "software-platform"
						? sql`${softwareRequirement.platformEntityId}`
						: sql`${softwareRequirement.tier}`,
				),
			);
			const otherConditions = expression.clauses
				.filter((clause) => !requirementClauses.has(clause))
				.map((clause) => compilePostgresSearchExpression(category, clause, profileId));
			return sql`(${unit.kind} = 'software' and exists (
				select 1 from ${softwareRequirement}
				where ${softwareRequirement.softwareId} = ${unit.id}
					and ${sql.join(requirementConditions, sql` and `)}
			)${otherConditions.length ? sql` and ${sql.join(otherConditions, sql` and `)}` : sql``})`;
		}
	}
	const clauses = expression.clauses.map((clause) =>
		compilePostgresSearchExpression(category, clause, profileId),
	);
	return sql`(${sql.join(clauses, expression.operator === "all" ? sql` and ` : sql` or `)})`;
}

function buildCommonSearchConditions(request: DomainSearchRequest): SQL[] {
	const readCondition = getUnitReadCondition(request.profileId, { discoverableOnly: true });
	if (!readCondition) throw new Error("Unit read policy produced no SQL condition");
	const conditions: SQL[] = [readCondition];
	conditions.push(
		getContentRatingCondition(request.contentRatingPolicy ?? DefaultContentRatingPolicy),
	);
	if (request.scopeUnitId) {
		const direct = sql`${unit.id} = ${request.scopeUnitId}::uuid`;
		conditions.push(
			request.includeScopeDescendants
				? sql`(${direct} or exists (
					select 1
					from ${contentStructureNode}
					inner join ${contentStructure}
						on ${contentStructure.id} = ${contentStructureNode.structureId}
					where ${contentStructureNode.ownerUnitId} = ${request.scopeUnitId}::uuid
						and ${contentStructureNode.contentUnitId} = ${unit.id}
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
				unitId: sql`${unit.id}`,
				unitKind: sql`${unit.kind}`,
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
		sql`${unit.kind}::text = ANY(${toTextArray(CurrentSearchUnitKindsByCategory[category])})`,
	);
	if (category === "posts")
		conditions.push(sql`exists (
			select 1 from ${post}
			where ${post.id} = ${unit.id} and ${post.kind} <> 'review'::post_kind
		)`);
	if (category === "reviews")
		conditions.push(sql`exists (
			select 1 from ${post}
			where ${post.id} = ${unit.id} and ${post.kind} = 'review'::post_kind
		)`);
	if (category === "tag-structures")
		conditions.push(sql`exists (
			select 1 from ${unitStructureVoteStat}
			where ${unitStructureVoteStat.structureId} = ${unit.id}
				and ${unitStructureVoteStat.score} > 0
		) and not exists (
			select 1
			from ${unitStructureMember} member
			join ${unit} member_unit on member_unit.id = member.member_unit_id
			where member.structure_id = ${unit.id}
				and (
					member_unit.kind <> 'tag'
					or member_unit.status <> 'published'
					or member_unit.visibility <> 'public'
					or member_unit.moderation_status <> 'approved'
					or member_unit.deleted_at is not null
				)
		)`);

	const query = request.query?.trim() ?? "";
	if (category === "units" && !query)
		conditions.push(sql`not exists (
			select 1 from ${unitVariant}
			where ${unitVariant.variantUnitId} = ${unit.id}
		)`);
	if (expression)
		conditions.push(compilePostgresSearchExpression(category, expression, request.profileId));
	return conditions;
}

function buildEffectiveSearchExpression(
	request: DomainSearchRequest,
): SearchExpression | undefined {
	const filters: SearchControlPredicate[] = [];
	const addValues = (field: SearchScalarField, values: readonly string[] | undefined) => {
		if (values?.length) filters.push({ field, operator: "any-of", values: [...values] });
	};
	const addValue = (field: SearchScalarField, value: string | undefined) => {
		if (value) filters.push({ field, operator: "equals", value });
	};
	const addBoolean = (field: SearchScalarField, value: boolean | undefined) => {
		if (value !== undefined) filters.push({ field, operator: "equals", value });
	};
	addValues(SearchFieldByDomainRequestFilter.Languages, request.Languages);
	addValues(SearchFieldByDomainRequestFilter.kind, request.kinds);
	addValues(SearchFieldByDomainRequestFilter.contentRating, request.contentRatings);
	addValues(SearchFieldByDomainRequestFilter.aiDisclosure, request.aiDisclosures);
	addValues(SearchFieldByDomainRequestFilter.license, request.licenses);
	if (request.contentLicenseActive !== undefined)
		filters.push({
			field: SearchFieldByDomainRequestFilter.contentLicenseActive,
			operator: "equals",
			value: request.contentLicenseActive,
		});
	addValue(SearchFieldByDomainRequestFilter.creditedUnitId, request.creditedUnitId);
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
	readonly sourceUnitKinds: readonly UnitKind[];
}

interface OrderedCandidateSource {
	readonly statement: SQL;
	readonly direction: "asc" | "desc";
}

const publicDiscoverableCandidate = sql`${unit.status} = 'published'::unit_status
	and ${unit.visibility} = 'public'::resource_visibility
	and ${unit.moderationStatus} = 'approved'::moderation_status
	and ${unit.deletedAt} is null`;

function resolveSourceUnitKinds(
	category: SearchCategory,
	requestedKinds?: readonly string[],
): readonly UnitKind[] {
	const categoryKinds = CurrentSearchUnitKindsByCategory[category];
	if (category !== "units" || !requestedKinds?.length) return categoryKinds;
	const requested = new Set(
		requestedKinds.filter((kind): kind is UnitKind =>
			UnitKindValues.some((candidate) => candidate === kind),
		),
	);
	return categoryKinds.filter((kind) => requested.has(kind));
}

function mergeSourceUnitKinds(branches: readonly PreparedSearchBranch[]): readonly UnitKind[] {
	return [...new Set(branches.flatMap(({ sourceUnitKinds }) => sourceUnitKinds))];
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
	sourceUnitKinds?: readonly UnitKind[],
): OrderedCandidateSource {
	if (position && position.source !== "best-positive" && position.source !== "best-zero")
		throw new InvalidSearch("This best cursor predates snapshot-pinned pagination");
	if (sourceUnitKinds?.length === 0)
		return {
			direction: "desc",
			statement: sql`select null::uuid as unit_id, 0::numeric as primary_order,
				0::numeric as secondary_order, 0::integer as source_phase,
				'best-zero'::text as source_name, null::uuid as snapshot_id,
				false as search_fallback where false`,
		};
	const bestPosition =
		position?.source === "best-positive" || position?.source === "best-zero" ? position : undefined;
	const selectedSnapshot = bestPosition
		? bestPosition.snapshotId === null
			? sql`select ${recommendationSnapshot.id} from ${recommendationSnapshot} where false`
			: sql`select ${recommendationSnapshot.id}
				from ${recommendationSnapshot}
				where ${recommendationSnapshot.id} = ${bestPosition.snapshotId}::uuid
					and ${recommendationSnapshot.state} = 'ready'::recommendation_snapshot_state`
		: sql`select ${recommendationSnapshot.id}
			from ${recommendationSnapshot}
			where ${recommendationSnapshot.active} = true
			limit 1`;
	const positivePosition = bestPosition?.source === "best-positive" ? bestPosition : undefined;
	const zeroPosition = bestPosition?.source === "best-zero" ? bestPosition : undefined;
	const includePositive = bestPosition?.source !== "best-zero" && bestPosition?.snapshotId !== null;
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
	const kindDimensions: readonly (UnitKind | undefined)[] = sourceUnitKinds?.length
		? sourceUnitKinds
		: [undefined];
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
			where ${kind ? sql`${unitBestScore.unitKind} = ${kind}` : sql`true`}
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
			select ${unit.id} as unit_id,
				0::numeric as primary_order,
				extract(epoch from ${unit.updatedAt})::numeric as secondary_order,
				1::integer as source_phase,
				'best-zero'::text as source_name,
				(select id from selected_best_snapshot) as snapshot_id,
				false as search_fallback
			from ${unit}
			${seeded ? sql`inner join filter_seed on filter_seed.unit_id = ${unit.id}` : sql``}
			where ${publicDiscoverableCandidate}
				and ${kind ? sql`${unit.kind} = ${kind}` : sql`true`}
				and not exists (
					select 1
					from ${unitBestScore}
					inner join selected_best_snapshot
						on selected_best_snapshot.id = ${unitBestScore.snapshotId}
					where ${unitBestScore.unitId} = ${unit.id}
				)
				and ${timestampKeysetCondition(
					sql`${unit.updatedAt}`,
					sql`${unit.id}`,
					"desc",
					zeroPosition,
					"secondary",
				)}
			order by ${unit.updatedAt} desc, ${unit.id} desc
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
			where ${unitFollowStat.followerCount} > 0
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
			select ${unit.id} as unit_id,
				0::numeric as primary_order,
				0::numeric as secondary_order,
				${zeroPhase}::integer as source_phase,
				'count-zero'::text as source_name,
				null::uuid as snapshot_id,
				false as search_fallback
			from ${unit}
			${seeded ? sql`inner join filter_seed on filter_seed.unit_id = ${unit.id}` : sql``}
			where ${publicDiscoverableCandidate}
				and not exists (
					select 1 from ${unitFollowStat}
					where ${unitFollowStat.unitId} = ${unit.id}
						and ${unitFollowStat.followerCount} > 0
				)
				and ${idKeysetCondition(sql`${unit.id}`, direction, zeroPosition)}
			order by ${unit.id} ${orderDirection}
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
	sourceUnitKinds: readonly UnitKind[],
	position: SearchKeysetPosition | undefined,
	limit: number,
): OrderedCandidateSource {
	const orderedPosition = requireOrderedPosition(position);
	const cursorValues = orderedPosition ? requirePositionValues(orderedPosition) : undefined;
	const cursorMicros = cursorValues
		? sql`round(${cursorValues.primary}::numeric * 1000000)::bigint`
		: sql`null::bigint`;
	if (!sourceUnitKinds.length)
		return {
			direction: "desc",
			statement: sql`select null::uuid as unit_id, 0::numeric as primary_order,
				0::numeric as secondary_order, 0::integer as source_phase,
				'ordered'::text as source_name, null::uuid as snapshot_id,
				false as search_fallback, false as search_matched where false`,
		};
	const kindSources = sourceUnitKinds.map(
		(kind) => sql`
			select text_candidate.unit_id,
				(text_candidate.unit_updated_at_micros::numeric / 1000000) as primary_order,
				0::numeric as secondary_order,
				0::integer as source_phase,
				'ordered'::text as source_name,
				null::uuid as snapshot_id,
				(not text_candidate.search_matched) as search_fallback,
				text_candidate.search_matched
			from public.search_text_candidates(
				${toTextArray(query.variants)},
				${toTextArray(languageBoundary)},
				${kind},
				${cursorMicros},
				${orderedPosition?.unitId ?? null}::uuid,
				${WorkPolicy.search.maxEstimatedPostings},
				${limit}
			) as text_candidate
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
): OrderedCandidateSource | undefined {
	if (sort === "best") return bestCandidateSource(position, limit, true);
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
	const resolvedSort = sort === "relevance" ? "updatedAt:desc" : sort;
	if (
		resolvedSort !== "createdAt:asc" &&
		resolvedSort !== "createdAt:desc" &&
		resolvedSort !== "updatedAt:asc" &&
		resolvedSort !== "updatedAt:desc" &&
		resolvedSort !== "publishedAt:asc" &&
		resolvedSort !== "publishedAt:desc"
	)
		return undefined;
	const timestamp = resolvedSort.startsWith("createdAt")
		? sql`${unit.createdAt}`
		: resolvedSort.startsWith("publishedAt")
			? sql`${unit.publishedAt}`
			: sql`${unit.updatedAt}`;
	if (resolvedSort.startsWith("publishedAt"))
		return nullableTimestampCandidateSource({
			column: timestamp,
			id: sql`${unit.id}`,
			relation: sql`${unit} inner join filter_seed on filter_seed.unit_id = ${unit.id}`,
			baseCondition: publicDiscoverableCandidate,
			direction,
			position: orderedPosition,
			limit,
		});
	return {
		direction,
		statement: sql`
			select ${unit.id} as unit_id,
				extract(epoch from ${timestamp})::numeric as primary_order,
				0::numeric as secondary_order,
				0::integer as source_phase,
				'ordered'::text as source_name,
				null::uuid as snapshot_id,
				false as search_fallback,
				false as search_matched
			from filter_seed
			inner join ${unit} on ${unit.id} = filter_seed.unit_id
			where ${publicDiscoverableCandidate}
				and ${timestampKeysetCondition(timestamp, sql`${unit.id}`, direction, orderedPosition)}
			order by ${timestamp} ${orderDirection}, ${unit.id} ${orderDirection}
			limit ${limit}`,
	};
}

function orderedCandidateSource(input: {
	readonly query: ExpandedSearchQuery;
	readonly sort: SearchSort;
	readonly position?: SearchKeysetPosition;
	readonly languageBoundary: readonly ContentLanguage[];
	readonly sourceUnitKinds: readonly UnitKind[];
	readonly limit: number;
}): OrderedCandidateSource {
	if (input.sort === "relevance")
		return textCandidateSource(
			input.query,
			input.languageBoundary,
			input.sourceUnitKinds,
			input.position,
			input.limit,
		);
	if (input.sort === "best")
		return bestCandidateSource(input.position, input.limit, false, input.sourceUnitKinds);
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
	const timestamps: Partial<Record<SearchSort, SQL>> = {
		"createdAt:asc": sql`${unit.createdAt}`,
		"createdAt:desc": sql`${unit.createdAt}`,
		"updatedAt:asc": sql`${unit.updatedAt}`,
		"updatedAt:desc": sql`${unit.updatedAt}`,
		"publishedAt:asc": sql`${unit.publishedAt}`,
		"publishedAt:desc": sql`${unit.publishedAt}`,
	};
	const timestamp = timestamps[input.sort];
	if (!timestamp) throw new InvalidSearch(`${input.sort} has no PostgreSQL search ordering`);
	if (input.sort === "publishedAt:asc" || input.sort === "publishedAt:desc")
		return nullableTimestampCandidateSource({
			column: timestamp,
			id: sql`${unit.id}`,
			relation: sql`${unit}`,
			baseCondition: publicDiscoverableCandidate,
			direction,
			position,
			limit: input.limit,
		});
	if (!input.sourceUnitKinds.length)
		return {
			direction,
			statement: sql`select null::uuid as unit_id, 0::numeric as primary_order,
				0::numeric as secondary_order, 0::integer as source_phase,
				'ordered'::text as source_name, null::uuid as snapshot_id,
				false as search_fallback where false`,
		};
	const kindSources = input.sourceUnitKinds.map(
		(kind) => sql`
			select ${unit.id} as unit_id,
				extract(epoch from ${timestamp})::numeric as primary_order,
				0::numeric as secondary_order,
				0::integer as source_phase,
				'ordered'::text as source_name,
				null::uuid as snapshot_id,
				false as search_fallback
			from ${unit}
			where ${publicDiscoverableCandidate}
				and ${unit.kind} = ${kind}
				and ${timestampKeysetCondition(timestamp, sql`${unit.id}`, direction, position)}
			order by ${timestamp} ${orderDirection}, ${unit.id} ${orderDirection}
			limit ${input.limit}`,
	);
	return {
		direction,
		statement: sql`
			select ordered_kind_source.*
			from (${sql.join(
				kindSources.map((branch) => sql`(${branch})`),
				sql` union all `,
			)}) as ordered_kind_source
			order by primary_order ${orderDirection}, unit_id ${orderDirection}
			limit ${input.limit}`,
	};
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
	const boundedMatch = sql`exists (
		select 1
		from ${unitSearchDocument} as ${boundedSearchDocument}
		where ${boundedSearchDocument.unitId} = bounded_search_candidate.unit_id
			and ${currentSearchDocumentCondition(query, languageBoundary)}
	)`;
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
	readonly candidateSet?: SQL;
	readonly commonConditions?: readonly SQL[];
	readonly query: ExpandedSearchQuery;
	readonly sort: SearchSort;
	readonly position?: SearchKeysetPosition;
	readonly limit: number;
	readonly scanLimit: number;
	readonly languageBoundary: readonly ContentLanguage[];
}): Promise<SearchCandidatePage> {
	if (!input.branches.length)
		return { rows: [], hasMore: false, scannedCount: 0, boundedTextFallback: false };
	const source =
		(input.candidateSet
			? seededUnitCandidateSource(input.sort, input.position, input.scanLimit + 1)
			: undefined) ??
		orderedCandidateSource({
			query: input.query,
			sort: input.sort,
			position: input.position,
			languageBoundary: input.languageBoundary,
			sourceUnitKinds: mergeSourceUnitKinds(input.branches),
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
	const snapshotAvailable =
		input.sort === "best" &&
		(input.position?.source === "best-positive" || input.position?.source === "best-zero")
			? input.position.snapshotId === null
				? sql`true`
				: sql`exists (
					select 1 from ${recommendationSnapshot}
					where ${recommendationSnapshot.id} = ${input.position.snapshotId}::uuid
						and ${recommendationSnapshot.state} = 'ready'::recommendation_snapshot_state
				)`
			: sql`true`;
	const result = await database.transaction(async (tx) => {
		await tx.execute(
			sql`select set_config('statement_timeout', ${String(env.SEARCH_STATEMENT_TIMEOUT_MS)}, true)`,
		);
		return tx.execute<SearchCandidateDatabaseRow>(sql`
			with ${
				input.candidateSet
					? sql`filter_seed(unit_id) as materialized (${input.candidateSet}),`
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
				select ${unit.id} as unit_id,
					scanned_candidates.primary_order,
					scanned_candidates.secondary_order,
					scanned_candidates.source_phase,
					scanned_candidates.source_name,
					scanned_candidates.snapshot_id
				from scanned_candidates
				inner join search_sources on search_sources.unit_id = scanned_candidates.unit_id
				inner join ${unit} on ${unit.id} = scanned_candidates.unit_id
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

async function resolveSparseCandidateSet(candidateSet: SQL | undefined): Promise<SQL | undefined> {
	if (!candidateSet) return undefined;
	const maximumCandidates = WorkPolicy.search.maxCandidatesScanned;
	const result = await database.transaction(async (tx) => {
		await tx.execute(
			sql`select set_config('statement_timeout', ${String(env.SEARCH_STATEMENT_TIMEOUT_MS)}, true)`,
		);
		return tx.execute<{ id: string }>(sql`
			select candidate_seed.unit_id::text as id
			from (${candidateSet}) as candidate_seed
			limit ${maximumCandidates + 1}
		`);
	});
	if (result.rows.length > maximumCandidates) return undefined;
	const ids = [...new Set(result.rows.map(({ id }) => id))];
	return sql`select bounded_seed.unit_id
		from unnest(${toUuidArray(ids)}) as bounded_seed(unit_id)`;
}

async function searchCandidatePage(input: {
	readonly branches: readonly PreparedSearchBranch[];
	readonly candidateSet?: SQL;
	readonly commonConditions?: readonly SQL[];
	readonly query: ExpandedSearchQuery;
	readonly sort: SearchSort;
	readonly position?: SearchKeysetPosition;
	readonly limit: number;
	readonly languageBoundary: readonly ContentLanguage[];
}): Promise<SearchCandidatePage> {
	if (!input.branches.length)
		return { rows: [], hasMore: false, scannedCount: 0, boundedTextFallback: false };
	const candidateSet = await resolveSparseCandidateSet(input.candidateSet);
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
	const hitType = category === "posts" ? sql`${post.kind}::text` : sql`${unit.kind}::text`;
	const result = await database.execute<{ hit: SearchHitWithoutSlugAddress }>(sql`
		select jsonb_build_object(
			'id', ${unit.id},
			'category', ${category}::text,
			'kind', ${hitType},
			'language', ${resolvedUnitLocalizationLanguage(
				unit.id,
				request.localizationLanguages,
				presentationLanguages,
			)},
			'title', ${resolvedUnitLocalizationTitle(
				unit.id,
				request.localizationLanguages,
				presentationLanguages,
			)},
			'summary', ${resolvedUnitLocalizationSummary(
				unit.id,
				request.localizationLanguages,
				presentationLanguages,
			)},
			'titles', coalesce((
				select jsonb_agg(localization.title order by localization.position, localization.language)
					filter (where localization.title is not null)
				from ${unitLocalization} localization
				where localization.unit_id = ${unit.id}
			), '[]'::jsonb),
			'summaries', coalesce((
				select jsonb_agg(localization.summary order by localization.position, localization.language)
					filter (where localization.summary is not null)
				from ${unitLocalization} localization
				where localization.unit_id = ${unit.id}
			), '[]'::jsonb)
		) as hit
		from ${unit}
		left join ${post} on ${post.id} = ${unit.id}
		where ${unit.id} = any(${toUuidArray(unitIds)})
	`);
	const byId = new Map(result.rows.map(({ hit }) => [hit.id, hit]));
	return unitIds.flatMap((id) => {
		const hit = byId.get(id);
		return hit ? [hit] : [];
	});
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
	facetFields: readonly string[] = [],
): Promise<
	| SearchDomainScanResult<SearchHitWithoutSlugAddress>
	| SearchDomainScanResult<SearchIdentifier>
	| (SearchDomainScanResult<SearchHitWithoutSlugAddress> & {
			readonly facets: SearchFacet[];
	  })
> {
	const startedAt = performance.now();
	const searchExpression = buildEffectiveSearchExpression(request);
	const presentationLanguages = [
		...new Set(
			[
				...(readSearchExpressionLanguageBoundary(searchExpression) ?? []),
				...(readUnitLanguageBoundary(request.domainFilter) ?? []),
			].filter(isContentLanguage),
		),
	];
	const expandedQuery = expandSearchQuery(request.query ?? "", presentationLanguages);
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
	const hasFacets = facetFields.some((field) => facetSpec(category, field));
	const candidates = await searchCandidatePage({
		branches: [
			{
				category,
				conditions,
				sourceUnitKinds: resolveSourceUnitKinds(category, request.kinds),
			},
		],
		...(request.domainFilter
			? {
					candidateSet: compileUnitPredicateCandidateSet(request.domainFilter, request.profileId),
				}
			: {}),
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
					facetFields,
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
		? { ...common, hits, ...(hasFacets ? { facets } : {}) }
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
	readonly sourceUnitKinds?: readonly UnitKind[];
}

export interface GlobalSearchIdentifiersRequest
	extends Omit<DomainSearchRequest, "cursor" | "searchExpression"> {
	readonly branches: readonly GlobalSearchBranch[];
	readonly cursor?: never;
	readonly position?: SearchKeysetPosition;
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
}

function prepareGlobalSearchRequest(
	request: GlobalSearchIdentifiersRequest,
): PreparedGlobalSearchRequest {
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
		const categoryKinds: readonly UnitKind[] = CurrentSearchUnitKindsByCategory[branch.category];
		const sourceUnitKinds =
			branch.sourceUnitKinds ?? resolveSourceUnitKinds(branch.category, commonRequest.kinds);
		if (sourceUnitKinds.some((kind) => !categoryKinds.includes(kind)))
			throw new InvalidSearch("Global Search branch has a Unit kind outside its category");
		return {
			category: branch.category,
			sourceUnitKinds,
			conditions: buildSearchConditions(branch.category, domainRequest, searchExpression, false),
			...(searchExpression ? { searchExpression } : {}),
		};
	});
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
		...(request.domainFilter
			? {
					candidateSet: compileUnitPredicateCandidateSet(request.domainFilter, request.profileId),
				}
			: {}),
		languageBoundary,
		query: expandSearchQuery(request.query ?? "", languageBoundary),
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
	const prepared = prepareGlobalSearchRequest(request);
	const page = await searchCandidatePage({
		branches: prepared.branches,
		candidateSet: prepared.candidateSet,
		commonConditions: prepared.commonConditions,
		query: prepared.query,
		sort: prepared.sort,
		position: request.position,
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
			value: sql`${facetLocalization.language}`,
			join: sql`join ${unitLocalization} as ${facetLocalization}
				on ${facetLocalization.unitId} = ${unit.id}`,
		};
	if (field === "tag")
		return {
			value: sql`${facetUnitTag.tagId}`,
			join: sql`join ${unitEffectiveTag} as ${facetUnitTag}
				on ${facetUnitTag.unitId} = ${unit.id}`,
		};
	if (field === "realm")
		return {
			value: sql`${facetRealmUnit.realmId}`,
			join: sql`join ${realmUnit} as ${facetRealmUnit}
				on ${facetRealmUnit.unitId} = ${unit.id} and ${facetRealmUnit.status} = 'visible'`,
		};
	if (field === "credit")
		return {
			value: sql`${facetCreditAttribution.creditedUnitId}`,
			join: sql`join ${creditAttribution} as ${facetCreditAttribution}
				on ${facetCreditAttribution.sourceUnitId} = ${unit.id}`,
		};
	if (field === "owner")
		return {
			value: sql`${facetOwnership.profileId}`,
			join: sql`join ${unitOwnership} as ${facetOwnership}
				on ${facetOwnership.unitId} = ${unit.id}
				and ${facetOwnership.revokedAt} is null`,
		};
	if (
		field === "kind" &&
		(category === "units" ||
			category === "entities" ||
			category === "posts" ||
			category === "reviews")
	)
		return {
			value:
				category === "entities"
					? sql`(select ${entity.kind} from ${entity} where ${entity.id} = ${unit.id})`
					: category === "reviews"
						? sql`(select ${subjectUnit.kind}
							from ${post}
							inner join ${unit} as ${subjectUnit}
								on ${subjectUnit.id} = ${post.subjectUnitId}
							where ${post.id} = ${unit.id})`
						: category === "posts"
							? sql`(select ${post.kind} from ${post} where ${post.id} = ${unit.id})`
							: sql`${unit.kind}`,
			join: none,
		};
	const scalar: Partial<Record<SearchField, SQL>> = {
		"content-rating": sql`${unit.contentRating}`,
		"ai-disclosure": sql`${unit.aiDisclosure}`,
		license: sql`${unit.license}`,
		"join-policy": sql`(select ${realm.joinPolicy} from ${realm} where ${realm.id} = ${unit.id})`,
		multiple: sql`(select ${poll.mode} = 'multiple' from ${poll} where ${poll.id} = ${unit.id})`,
		"results-visibility": sql`(select ${poll.resultVisibility}
			from ${poll} where ${poll.id} = ${unit.id})`,
		closed: sql`(select ${poll.closedAt} is not null or ${poll.closesAt} <= now()
			from ${poll} where ${poll.id} = ${unit.id})`,
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
				count(distinct ${unit.id})::text as count
			from search_candidate
			inner join ${unit} on ${unit.id} = search_candidate.unit_id
			${spec.join}
			where (${spec.value}) is not null
			group by (${spec.value})
			order by count(distinct ${unit.id}) desc, (${spec.value})::text
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
	const expandedQuery = expandSearchQuery(request.query ?? "", languageBoundary);
	const candidates = await searchCandidatePage({
		branches: [
			{
				category,
				conditions,
				sourceUnitKinds: resolveSourceUnitKinds(category, request.kinds),
			},
		],
		...(request.domainFilter
			? {
					candidateSet: compileUnitPredicateCandidateSet(request.domainFilter, request.profileId),
				}
			: {}),
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
				count(distinct ${unit.id})::text as count
			from eligible_category
			inner join ${unit} on ${unit.id} = eligible_category.unit_id
			${spec.join}
			where eligible_category.category = ${category}::text
				and (${spec.value}) is not null
			group by (${spec.value})
			order by count(distinct ${unit.id}) desc, (${spec.value})::text
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
		select ${unit.id}, eligibility.category
		from search_candidate
		inner join ${unit} on ${unit.id} = search_candidate.unit_id
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
			sourceUnitKinds: resolveSourceUnitKinds(category, request.kinds),
			conditions: buildSearchConditions(category, request, searchExpression),
		};
	});
	if (
		!preparedBranches.some((branch) =>
			branch.fields.some((field) => facetSpec(branch.category, field)),
		)
	)
		return [];
	const first = preparedBranches[0];
	if (!first) return [];
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
	const expandedQuery = expandSearchQuery(first.request.query ?? "", languageBoundary);
	const candidates = await searchCandidatePage({
		branches: preparedBranches,
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
	const prepared = prepareGlobalSearchRequest(request);
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
				limit: request.limitPerIndex ?? 5,
				contentRatingPolicy: request.contentRatingPolicy,
			});
			return { index: category, ...result };
		}),
	);
	return { query: request.query ?? "", groups };
}
