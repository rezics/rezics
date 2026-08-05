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
import { database } from "../database";
import {
	book,
	unitContentLicense,
	collection,
	creditAttribution,
	contentStructure,
	contentStructureNode,
	entity,
	media,
	poll,
	post,
	postReply,
	postReplyStat,
	profile,
	unitFollowStat,
	realm,
	realmTagContext,
	realmTagVoteStat,
	realmUnit,
	software,
	softwareRequirement,
	recommendationSnapshot,
	recommendationUnitStat,
	unit,
	unitOwnership,
	unitLocalization,
	unitEffectiveTag,
	unitStructureMember,
	unitStructureVoteStat,
	unitVariant,
	VariantCapableUnitKindValues,
} from "../database/schema";
import { env } from "../config";
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
import { getPublicCanonicalUnitSlugAddresses } from "../units/slug-address";
import { compileUnitPredicateSql } from "../filter/sql";

const subjectUnit = alias(unit, "subject_unit");
const searchLocalization = alias(unitLocalization, "search_localization");
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
		[
			"Languages",
			SearchFieldByDomainRequestFilter.Languages,
			Boolean(request.Languages?.length),
		],
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
		if (filter.operator === "not-equals" || filter.operator === "none-of")
			return sql`${!matches}`;
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
							and(
								eq(unitContentLicense.unitId, unit.id),
								eq(unitContentLicense.status, "active"),
							),
						),
				),
				filter,
			),
		);
		if (!condition) throw new Error("Unit content License filter produced no SQL condition");
		return condition;
	}
	const typeSpecificScalar: Partial<
		Record<SearchControlPredicate["field"], { readonly kind: string; readonly column: SQL }>
	> = {
		"book-isbn13": { kind: "book", column: sql`${book.isbn13}` },
		"book-publication-date": { kind: "book", column: sql`${book.publicationDate}` },
		"book-format": { kind: "book", column: sql`${book.format}` },
		"media-kind": { kind: "media", column: sql`${media.kind}` },
		"media-release-date": { kind: "media", column: sql`${media.releaseDate}` },
		"software-release-date": { kind: "software", column: sql`${software.releaseDate}` },
		"software-version-label": { kind: "software", column: sql`${software.versionLabel}` },
	};
	const scalarDefinition = typeSpecificScalar[filter.field];
	if (scalarDefinition)
		return sql`${unit.kind}::text = ${scalarDefinition.kind} and ${scalarColumnCondition(
			scalarDefinition.column,
			filter,
		)}`;
	const typeSpecificNumeric: Partial<
		Record<SearchControlPredicate["field"], { readonly kind: string; readonly column: SQL }>
	> = {
		"book-page-count": { kind: "book", column: sql`${book.pageCount}` },
		"book-word-count": { kind: "book", column: sql`${book.wordCount}` },
		"media-runtime-minutes": { kind: "media", column: sql`${media.runtimeMinutes}` },
		"media-episode-count": { kind: "media", column: sql`${media.episodeCount}` },
		"media-season-count": { kind: "media", column: sql`${media.seasonCount}` },
	};
	const numericDefinition = typeSpecificNumeric[filter.field];
	if (numericDefinition)
		return sql`${unit.kind}::text = ${numericDefinition.kind} and ${numericColumnCondition(
			numericDefinition.column,
			filter,
		)}`;
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
		return filter.operator === "not-equals" ? sql`not (${match})` : match;
	}

	const columnByField: Partial<Record<SearchControlPredicate["field"], SQL>> = {
		kind:
			category === "entities"
				? sql`${entity.kind}`
				: category === "posts"
					? sql`${post.kind}`
					: category === "reviews"
						? sql`${subjectUnit.kind}`
						: sql`${unit.kind}`,
		"content-rating": sql`${unit.contentRating}`,
		"ai-disclosure": sql`${unit.aiDisclosure}`,
		license: sql`${unit.license}`,
		subject: sql`${post.subjectUnitId}`,
		target: sql`${post.subjectUnitId}`,
		root: sql`${postReply.rootPostId}`,
		parent: sql`${postReply.parentPostId}`,
		"join-policy": sql`${realm.joinPolicy}`,
		"results-visibility": sql`${poll.resultVisibility}`,
		"created-at": sql`${unit.createdAt}`,
		"updated-at": sql`${unit.updatedAt}`,
		"published-at": sql`${unit.publishedAt}`,
		"closes-at": sql`${poll.closesAt}`,
	};
	const column = columnByField[filter.field];
	if (!column) throw new InvalidSearch(`${filter.field} is not implemented`);
	return scalarColumnCondition(column, filter);
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
				(clause.field === "software-platform" ||
					clause.field === "software-requirement-tier"),
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

function buildSearchConditions(
	category: SearchCategory,
	request: DomainSearchRequest,
	expression: SearchExpression | undefined,
): SQL[] {
	validateRequest(category, request);
	const readCondition = getUnitReadCondition(request.profileId, { discoverableOnly: true });
	if (!readCondition) throw new Error("Unit read policy produced no SQL condition");

	const conditions: SQL[] = [
		readCondition,
		sql`${unit.kind}::text = ANY(${toTextArray(CurrentSearchUnitKindsByCategory[category])})`,
	];
	if (category === "posts") conditions.push(sql`${post.kind} <> 'review'::post_kind`);
	if (category === "reviews") conditions.push(sql`${post.kind} = 'review'`);
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
	if (expression)
		conditions.push(compilePostgresSearchExpression(category, expression, request.profileId));
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
	addValue(
		SearchFieldByDomainRequestFilter.realmTagContextRealmId,
		request.realmTagContextRealmId,
	);
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
}

interface SearchCandidatePage {
	readonly rows: readonly SearchCandidateRow[];
	readonly hasMore: boolean;
	readonly scanTruncated: boolean;
}

interface SearchCandidateDatabaseRow extends Record<string, unknown> {
	readonly id: string | null;
	readonly primaryValue: string | null;
	readonly secondaryValue: string | null;
	readonly scanTruncated: boolean;
}

function readSearchCandidateRows(
	rows: readonly SearchCandidateDatabaseRow[],
): readonly SearchCandidateRow[] {
	const candidates: SearchCandidateRow[] = [];
	for (const row of rows) {
		if (row.id === null && row.primaryValue === null && row.secondaryValue === null) continue;
		if (
			typeof row.id !== "string" ||
			typeof row.primaryValue !== "string" ||
			typeof row.secondaryValue !== "string"
		)
			throw new Error("PostgreSQL returned an invalid Search candidate row");
		candidates.push({
			id: row.id,
			primaryValue: row.primaryValue,
			secondaryValue: row.secondaryValue,
		});
	}
	return candidates;
}

interface PreparedSearchBranch {
	readonly category: SearchCategory;
	readonly conditions: readonly SQL[];
}

interface SearchSortSql {
	readonly primary: SQL;
	readonly secondary: SQL;
	readonly direction: "asc" | "desc";
}

function currentSearchTextCondition(query: string): SQL {
	if (!query) return sql`true`;
	return sql`(
		public.current_search_metadata_v1(
			${searchLocalization.title},
			${searchLocalization.summary},
			${searchLocalization.description}
		) &@~ ${query}
		or (
			${searchLocalization.contentStatus} = 'published'::content_status
			and public.current_search_text_v1(${searchLocalization.content}) &@~ ${query}
		)
	)`;
}

function currentSearchSort(sort: SearchSort, query: string): SearchSortSql {
	if (sort === "relevance") {
		if (!query) throw new InvalidSearch("relevance requires a text query");
		return {
			primary: sql`pgroonga_score(search_localization.tableoid, search_localization.ctid)::numeric`,
			secondary: sql`extract(epoch from ${unit.updatedAt})::numeric`,
			direction: "desc",
		};
	}
	if (sort === "best")
		return {
			primary: sql`coalesce((
				select ${recommendationUnitStat.engagement24h}
				from ${recommendationUnitStat}
				inner join ${recommendationSnapshot}
					on ${recommendationSnapshot.id} = ${recommendationUnitStat.snapshotId}
					and ${recommendationSnapshot.active} = true
				where ${recommendationUnitStat.unitId} = ${unit.id}
					and ${recommendationUnitStat.contextRealmId} is null
				limit 1
			), 0)::numeric`,
			secondary: sql`extract(epoch from ${unit.updatedAt})::numeric`,
			direction: "desc",
		};
	const timestampSorts: Partial<Record<SearchSort, SQL>> = {
		"createdAt:asc": sql`extract(epoch from ${unit.createdAt})::numeric`,
		"createdAt:desc": sql`extract(epoch from ${unit.createdAt})::numeric`,
		"updatedAt:asc": sql`extract(epoch from ${unit.updatedAt})::numeric`,
		"updatedAt:desc": sql`extract(epoch from ${unit.updatedAt})::numeric`,
		"publishedAt:asc": sql`coalesce(extract(epoch from ${unit.publishedAt})::numeric, 1e100::numeric)`,
		"publishedAt:desc": sql`coalesce(extract(epoch from ${unit.publishedAt})::numeric, -1e100::numeric)`,
		"closesAt:asc": sql`coalesce(extract(epoch from ${poll.closesAt})::numeric, 1e100::numeric)`,
		"closesAt:desc": sql`coalesce(extract(epoch from ${poll.closesAt})::numeric, -1e100::numeric)`,
	};
	const timestamp = timestampSorts[sort];
	if (timestamp)
		return {
			primary: timestamp,
			secondary: sql`0::numeric`,
			direction: sort.endsWith(":asc") ? "asc" : "desc",
		};
	if (sort === "followerCount:asc" || sort === "followerCount:desc")
		return {
			primary: sql`coalesce(${unitFollowStat.followerCount}, 0)::numeric`,
			secondary: sql`0::numeric`,
			direction: sort.endsWith(":asc") ? "asc" : "desc",
		};
	if (sort === "replyCount:asc" || sort === "replyCount:desc")
		return {
			primary: sql`coalesce(case when ${post.kind} = 'reply' then ${postReplyStat.undeletedDirectCount} else ${postReplyStat.undeletedDescendantCount} end, 0)::numeric`,
			secondary: sql`0::numeric`,
			direction: sort.endsWith(":asc") ? "asc" : "desc",
		};
	throw new InvalidSearch(`${sort} has no PostgreSQL search ordering`);
}

function keysetCondition(sort: SearchSortSql, position: SearchKeysetPosition | undefined): SQL {
	if (!position) return sql`true`;
	if (position.primary === null || position.secondary === null)
		throw new InvalidSearch("Search cursor is missing a sort value");
	const primary = sql`${position.primary}::numeric`;
	const secondary = sql`${position.secondary}::numeric`;
	return sort.direction === "asc"
		? sql`(
			primary_order > ${primary}
			or (primary_order = ${primary} and secondary_order > ${secondary})
			or (primary_order = ${primary} and secondary_order = ${secondary} and unit_id > ${position.unitId}::uuid)
		)`
		: sql`(
			primary_order < ${primary}
			or (primary_order = ${primary} and secondary_order < ${secondary})
			or (primary_order = ${primary} and secondary_order = ${secondary} and unit_id > ${position.unitId}::uuid)
		)`;
}

async function searchCandidatePage(input: {
	readonly branches: readonly PreparedSearchBranch[];
	readonly query: string;
	readonly sort: SearchSort;
	readonly position?: SearchKeysetPosition;
	readonly limit: number;
	readonly languageBoundary: readonly ContentLanguage[];
}): Promise<SearchCandidatePage> {
	if (!input.branches.length) return { rows: [], hasMore: false, scanTruncated: false };
	const sort = currentSearchSort(input.sort, input.query);
	const branchConditions = input.branches.map(
		(branch) => sql`(${sql.join([...branch.conditions], sql` and `)})`,
	);
	const languageCondition = input.languageBoundary.length
		? inArray(searchLocalization.language, input.languageBoundary)
		: sql`true`;
	const orderDirection = sort.direction === "asc" ? sql`asc` : sql`desc`;
	const result = await database.transaction(async (tx) => {
		await tx.execute(
			sql`select set_config('statement_timeout', ${String(env.SEARCH_STATEMENT_TIMEOUT_MS)}, true)`,
		);
		return tx.execute<SearchCandidateDatabaseRow>(sql`
			with candidate_localizations as materialized (
				select ${searchLocalization}.tableoid as tableoid,
					${searchLocalization}.ctid as ctid,
					${searchLocalization}.*
				from ${unitLocalization} as ${searchLocalization}
				where ${currentSearchTextCondition(input.query)}
					and ${languageCondition}
				limit ${env.SEARCH_CANDIDATE_SCAN_LIMIT + 1}
			), bounded_candidate_localizations as materialized (
				select * from candidate_localizations
				limit ${env.SEARCH_CANDIDATE_SCAN_LIMIT}
			), candidate_status as (
				select exists (
					select 1 from candidate_localizations
					offset ${env.SEARCH_CANDIDATE_SCAN_LIMIT}
				) as scan_truncated
			), matched_localizations as (
				select distinct on (${unit.id})
					${unit.id} as unit_id,
					${sort.primary} as primary_order,
					${sort.secondary} as secondary_order
				from bounded_candidate_localizations as ${searchLocalization}
				inner join lateral (
					select candidate_unit.*
					from ${unit} candidate_unit
					where candidate_unit.id = ${searchLocalization.unitId}
					offset 0
				) as ${unit} on true
				left join ${profile} on ${profile.id} = ${unit.id}
				left join ${entity} on ${entity.id} = ${unit.id}
				left join ${post} on ${post.id} = ${unit.id}
				left join ${postReply} on ${postReply.postId} = ${unit.id}
				left join ${postReplyStat} on ${postReplyStat.postId} = ${unit.id}
				left join ${unitFollowStat} on ${unitFollowStat.unitId} = ${unit.id}
				left join ${unit} as ${subjectUnit} on ${subjectUnit.id} = ${post.subjectUnitId}
				left join ${realm} on ${realm.id} = ${unit.id}
				left join ${collection} on ${collection.id} = ${unit.id}
				left join ${poll} on ${poll.id} = ${unit.id}
				left join ${book} on ${book.id} = ${unit.id}
				left join ${media} on ${media.id} = ${unit.id}
				left join ${software} on ${software.id} = ${unit.id}
				where (${sql.join(branchConditions, sql` or `)})
				order by ${unit.id}, ${sort.primary} desc,
					${searchLocalization.position}, ${searchLocalization.language}
			), page as (
				select unit_id, primary_order, secondary_order
				from matched_localizations
				where ${keysetCondition(sort, input.position)}
				order by primary_order ${orderDirection}, secondary_order ${orderDirection}, unit_id asc
				limit ${input.limit + 1}
			)
			select page.unit_id::text as id,
				page.primary_order::text as "primaryValue",
				page.secondary_order::text as "secondaryValue",
				candidate_status.scan_truncated as "scanTruncated"
			from candidate_status
			left join page on true
			order by page.primary_order ${orderDirection} nulls last,
				page.secondary_order ${orderDirection} nulls last,
				page.unit_id asc nulls last
		`);
	});
	const candidates = readSearchCandidateRows(result.rows);
	return {
		rows: candidates.slice(0, input.limit),
		hasMore: candidates.length > input.limit,
		scanTruncated: result.rows[0]?.scanTruncated ?? false,
	};
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
async function searchDomainScan(
	category: SearchCategory,
	request: DomainSearchRequest,
	presentation: "hits" | "identifiers",
): Promise<
	SearchDomainScanResult<SearchHitWithoutSlugAddress> | SearchDomainScanResult<SearchIdentifier>
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
	const conditions = buildSearchConditions(category, request, searchExpression);
	const sort = request.sort ?? (request.query?.trim() ? "relevance" : "best");
	const limit = request.limit ?? 20;
	const requestHash = createHash("sha256")
		.update(
			JSON.stringify({
				category,
				query: request.query?.trim() ?? "",
				limit,
				sort,
				localizationLanguages: request.localizationLanguages,
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
			throw new InvalidSearch(
				cause instanceof Error ? cause.message : "Invalid Search cursor",
			);
		}
		if (cursor.requestHash !== requestHash || cursor.pageSize !== limit)
			throw new InvalidSearch("Search cursor does not match this request");
		const categoryState = cursor.categories[category];
		cursorSeen = categoryState?.seen ?? 0;
		cursorPosition = categoryState?.position;
	}
	const page = await searchCandidatePage({
		branches: [{ category, conditions }],
		query: request.query?.trim() ?? "",
		sort,
		position: cursorPosition,
		limit,
		languageBoundary: presentationLanguages,
	});
	const identifiers = page.rows.map(({ id }) => ({ id }));
	const hits =
		presentation === "hits"
			? await hydrateSearchHits(
					category,
					page.rows.map(({ id }) => id),
					request,
					presentationLanguages,
				)
			: [];
	const seen = cursorSeen + page.rows.length;
	const last = page.rows.at(-1);
	const nextPosition =
		page.hasMore && last
			? ({
					primary: last.primaryValue,
					secondary: last.secondaryValue,
					unitId: last.id,
				} satisfies SearchKeysetPosition)
			: undefined;
	const lowerBound = page.hasMore || page.scanTruncated;
	metrics.searchCandidateScan(
		"current",
		page.rows.length,
		page.rows.length,
		1,
		page.scanTruncated,
		lowerBound,
	);
	const common = {
		total: {
			kind: lowerBound ? "lower-bound" : "exact",
			value: seen + (page.hasMore ? 1 : 0),
		} as const,
		offset: cursorSeen,
		nextOffset: seen,
		exhausted: !page.hasMore,
		nextPosition,
		nextCursor: !nextPosition
			? undefined
			: createSearchCursor({
					version: 1,
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
	return presentation === "hits" ? { ...common, hits } : { ...common, hits: identifiers };
}

/**
 * Executes current-state Unit search.
 *
 * @remarks
 * REZICS v1 intentionally searches only current Unit localizations. Unit-local revision history
 * remains available through its authoritative history APIs.
 *
 * @todo
 * Add global revision full-text search after its authorization, lifecycle, ranking,
 * deduplication, cursor, retention, capacity, backup, restore, and PGroonga reindex contracts are
 * specified and measured.
 */
export async function searchDomain(category: SearchCategory, request: DomainSearchRequest) {
	const result = await searchDomainScan(category, request, "hits");
	const slugAddresses = await getPublicCanonicalUnitSlugAddresses(
		result.hits.map((hit) => hit.id),
	);
	return {
		...result,
		hits: result.hits.map((hit) => ({
			...hit,
			slugAddress: slugAddresses.get(hit.id) ?? null,
		})),
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
}

export interface GlobalSearchIdentifiersRequest extends Omit<
	DomainSearchRequest,
	"cursor" | "searchExpression"
> {
	readonly branches: readonly GlobalSearchBranch[];
	readonly cursor?: never;
	readonly position?: SearchKeysetPosition;
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
	if (!request.branches.length) throw new InvalidSearch("Search requires at least one category");
	if (new Set(request.branches.map(({ category }) => category)).size !== request.branches.length)
		throw new InvalidSearch("Search categories must be unique");

	const { branches, ...commonRequest } = request;
	const preparedBranches = branches.map((branch) => {
		const domainRequest = {
			...commonRequest,
			...(branch.searchExpression ? { searchExpression: branch.searchExpression } : {}),
		} satisfies DomainSearchRequest;
		const searchExpression = buildEffectiveSearchExpression(domainRequest);
		return {
			category: branch.category,
			conditions: buildSearchConditions(branch.category, domainRequest, searchExpression),
			...(searchExpression ? { searchExpression } : {}),
		};
	});
	const sort = request.sort ?? (request.query?.trim() ? "relevance" : "best");
	const limit = request.limit ?? 20;
	const initialOffset = request.offset ?? 0;
	const languageBoundary = [
		...new Set(
			[
				...preparedBranches.flatMap(
					({ searchExpression }) =>
						readSearchExpressionLanguageBoundary(searchExpression) ?? [],
				),
				...(readUnitLanguageBoundary(request.domainFilter) ?? []),
			].filter(isContentLanguage),
		),
	];
	const page = await searchCandidatePage({
		branches: preparedBranches,
		query: request.query?.trim() ?? "",
		sort,
		position: request.position,
		limit,
		languageBoundary,
	});
	const identifiers = page.rows.map(({ id }) => ({ id }));
	const nextOffset = initialOffset + identifiers.length;
	const last = page.rows.at(-1);
	const nextPosition =
		page.hasMore && last
			? ({
					primary: last.primaryValue,
					secondary: last.secondaryValue,
					unitId: last.id,
				} satisfies SearchKeysetPosition)
			: undefined;
	metrics.searchCandidateScan(
		"current",
		identifiers.length,
		identifiers.length,
		1,
		page.scanTruncated,
		page.hasMore || page.scanTruncated,
	);
	const lowerBound = page.hasMore || page.scanTruncated;
	return {
		hits: identifiers,
		total: {
			kind: lowerBound ? "lower-bound" : "exact",
			value: nextOffset + (page.hasMore ? 1 : 0),
		},
		offset: initialOffset,
		nextOffset,
		exhausted: !page.hasMore,
		nextPosition,
		limit,
		processingTimeMs: Math.round((performance.now() - startedAt) * 1000) / 1000,
	};
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
					? sql`${entity.kind}`
					: category === "reviews"
						? sql`${subjectUnit.kind}`
						: category === "posts"
							? sql`${post.kind}`
							: sql`${unit.kind}`,
			join: none,
		};
	const scalar: Partial<Record<SearchField, SQL>> = {
		"content-rating": sql`${unit.contentRating}`,
		"ai-disclosure": sql`${unit.aiDisclosure}`,
		license: sql`${unit.license}`,
		"join-policy": sql`${realm.joinPolicy}`,
		multiple: sql`${poll.mode} = 'multiple'`,
		"results-visibility": sql`${poll.resultVisibility}`,
		closed: sql`${poll.closedAt} is not null or ${poll.closesAt} <= now()`,
	};
	const value = scalar[field];
	return value ? { value, join: none } : undefined;
}

/** Conjunctive facet counts for the effective configured request, batched per category. */
export async function searchDomainFacets(
	category: SearchCategory,
	request: DomainSearchRequest,
	fields: readonly string[],
): Promise<SearchFacet[]> {
	if (!fields.length) return [];
	const requestedFacets = fields.flatMap((field) => {
		const spec = facetSpec(category, field);
		return spec ? [{ field, spec }] : [];
	});
	if (!requestedFacets.length) return [];
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
	const candidates = await searchCandidatePage({
		branches: [{ category, conditions }],
		query: request.query?.trim() ?? "",
		sort: request.sort ?? (request.query?.trim() ? "relevance" : "best"),
		limit: candidateLimit,
		languageBoundary,
	});
	const exhausted = !candidates.hasMore;
	metrics.searchFacetScan("current", candidates.rows.length, 1, !exhausted);
	if (!candidates.rows.length) return [];
	const candidateIds = candidates.rows.map(({ id }) => id);
	const queries = requestedFacets.map(
		({ field, spec }) =>
			sql`(
				select ${field}::text as field, (${spec.value})::text as value,
				count(distinct ${unit.id})::text as count
			from search_candidate
			join ${unit} on ${unit.id} = search_candidate.unit_id
			left join ${profile} on ${profile.id} = ${unit.id}
			left join ${entity} on ${entity.id} = ${unit.id}
			left join ${post} on ${post.id} = ${unit.id}
			left join ${postReply} on ${postReply.postId} = ${unit.id}
			left join ${unit} as ${subjectUnit} on ${subjectUnit.id} = ${post.subjectUnitId}
			left join ${realm} on ${realm.id} = ${unit.id}
			left join ${collection} on ${collection.id} = ${unit.id}
			left join ${poll} on ${poll.id} = ${unit.id}
			left join ${book} on ${book.id} = ${unit.id}
			left join ${media} on ${media.id} = ${unit.id}
			left join ${software} on ${software.id} = ${unit.id}
			${spec.join}
			where ${sql.join(conditions, sql` and `)} and (${spec.value}) is not null
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

export async function searchGrouped(request: {
	profileId?: string;
	query?: string;
	indexes: SearchCategory[];
	localizationLanguages: readonly ContentLanguage[];
	Languages?: ContentLanguage[];
	limitPerIndex?: number;
}) {
	const groups = await Promise.all(
		request.indexes.map(async (category) => {
			const result = await searchDomain(category, {
				profileId: request.profileId,
				query: request.query,
				localizationLanguages: request.localizationLanguages,
				Languages: request.Languages,
				limit: request.limitPerIndex ?? 5,
			});
			return { index: category, ...result };
		}),
	);
	return { query: request.query ?? "", groups };
}
