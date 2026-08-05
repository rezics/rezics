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
import { FontAwesomeProvider } from "@rezics/avatar";
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
	searchUnitProjectionSource,
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
	firstUnitLocalizationTitle,
	localizationLanguageOrder,
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
} from "../units/localization";
import { InvalidSearch } from "./errors";
import { compileCandidateDomainFilter } from "./candidate-domain";
import { CurrentSearchUnitKindsByCategory } from "./contracts";
import {
	getCurrentSearchFieldDefinition,
	resolveCurrentSearchFilterDefinition,
	resolveCurrentSearchSortDefinition,
	searchFilterValues,
	supportsCurrentSearchField,
} from "./field-registry";
import { getActiveSearchGeneration } from "./generation";
import {
	createCandidateSearchContext,
	searchCandidates,
	type CandidateQueryBranch,
	type CandidateSearchContext,
} from "./meilisearch";
import {
	assertSearchExpression,
	combineSearchExpressions,
	createSearchCursor,
	parseSearchCursor,
	readSearchExpressionLanguageBoundary,
	type GroupedSearchCursorToken,
	type SearchExpression,
} from "./query";
import {
	SearchFieldByDomainRequestFilter,
	type DomainSearchRequest,
	type SearchCategory,
	type SearchHit,
} from "./schema";
import { getPublicCanonicalUnitSlugAddresses } from "../units/slug-address";
import { compileUnitPredicateSql } from "../filter/sql";

const subjectUnit = alias(unit, "subject_unit");
const searchVariantRelationship = alias(unitVariant, "search_variant_relationship");
const searchMainUnit = alias(unit, "search_main_unit");
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

function toIntegerArray(values: readonly number[]): SQL {
	if (values.some((value) => !Number.isSafeInteger(value) || value < 1))
		throw new TypeError("Search candidate positions must be positive integers");
	return sql`ARRAY[${sql.join(
		values.map((value) => sql`${value}`),
		sql`, `,
	)}]::integer[]`;
}

function toBigIntArray(values: readonly number[]): SQL {
	if (values.some((value) => !Number.isSafeInteger(value) || value < 1))
		throw new TypeError("Search candidate revisions must be positive safe integers");
	return sql`ARRAY[${sql.join(
		values.map((value) => sql`${value}::bigint`),
		sql`, `,
	)}]::bigint[]`;
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
	readonly limit: number;
	readonly processingTimeMs: number;
}

async function resolveCandidateContext(
	profileId: string | undefined,
	context: CandidateSearchContext | undefined,
): Promise<CandidateSearchContext> {
	if (context) return context;
	const generation = await getActiveSearchGeneration("current");
	return createCandidateSearchContext(generation, profileId);
}

function searchDomainScan(
	category: SearchCategory,
	request: DomainSearchRequest,
	presentation: "hits",
	candidateContext?: CandidateSearchContext,
): Promise<SearchDomainScanResult<SearchHitWithoutSlugAddress>>;
function searchDomainScan(
	category: SearchCategory,
	request: DomainSearchRequest,
	presentation: "identifiers",
	candidateContext?: CandidateSearchContext,
): Promise<SearchDomainScanResult<SearchIdentifier>>;
async function searchDomainScan(
	category: SearchCategory,
	request: DomainSearchRequest,
	presentation: "hits" | "identifiers",
	providedCandidateContext?: CandidateSearchContext,
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
	const candidateContext = await resolveCandidateContext(
		request.profileId,
		providedCandidateContext,
	);
	const domainCandidateFilter = compileCandidateDomainFilter(request.domainFilter);
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
	let cursorOffset: number | undefined;
	if (request.cursor) {
		let cursor: ReturnType<typeof parseSearchCursor>;
		try {
			cursor = parseSearchCursor(request.cursor);
		} catch (cause) {
			throw new InvalidSearch(
				cause instanceof Error ? cause.message : "Invalid Search cursor",
			);
		}
		if (
			cursor.generationId !== candidateContext.generationId ||
			cursor.requestHash !== requestHash ||
			cursor.pageSize !== limit
		)
			throw new InvalidSearch("Search cursor does not match this generation or request");
		cursorOffset = cursor.categories[category]?.offset;
	}
	const initialOffset = request.offset ?? cursorOffset ?? 0;
	const hitType = category === "posts" ? sql`${post.kind}::text` : sql`${unit.kind}::text`;
	const readableSearchMain = getUnitReadCondition(
		request.profileId,
		{ discoverableOnly: true },
		searchMainUnit,
	);
	const localizedSearchMainCoverAssetId = resolvedUnitLocalizationImageAssetId(
		searchMainUnit.id,
		"cover",
		request.localizationLanguages,
	);
	const hits: SearchHitWithoutSlugAddress[] = [];
	const identifiers: SearchIdentifier[] = [];
	const seen = new Set<string>();
	let authorizedCount = 0;
	let scanOffset = initialOffset;
	let exhausted = false;
	let rounds = 0;
	let pageBoundaryOffset: number | undefined;
	const authorizationTarget = limit + 1;
	const maxCandidateRounds = env.SEARCH_CANDIDATE_MAX_ROUNDS ?? 4;
	const candidateDeadline = performance.now() + (env.SEARCH_CANDIDATE_TIME_BUDGET_MS ?? 1_500);

	while (
		!exhausted &&
		authorizedCount < authorizationTarget &&
		scanOffset - initialOffset < env.SEARCH_CANDIDATE_SCAN_LIMIT &&
		rounds < maxCandidateRounds &&
		performance.now() < candidateDeadline
	) {
		const batchLimit = Math.min(
			env.SEARCH_CANDIDATE_BATCH_SIZE * 2 ** rounds,
			env.SEARCH_CANDIDATE_SCAN_LIMIT - (scanOffset - initialOffset),
		);
		rounds += 1;
		const [candidateResult] = await searchCandidates([
			{
				indexUid: candidateContext.indexUid,
				accessFilter: candidateContext.accessFilter,
				domainFilter: domainCandidateFilter,
				category,
				query: request.query?.trim() ?? "",
				offset: scanOffset,
				limit: batchLimit,
				expression: searchExpression,
				sort,
			},
		]);
		if (!candidateResult) throw new Error("Meilisearch omitted a candidate result");
		const candidateEntries = candidateResult.hits.flatMap((candidate, index) => {
			const id = candidate.id;
			if (seen.has(id)) return [];
			seen.add(id);
			return [{ id, position: index + 1, revision: candidate.revision }];
		});
		const candidateIds = candidateEntries.map((candidate) => candidate.id);
		const candidatePositions = candidateEntries.map((candidate) => candidate.position);
		const candidateRevisions = candidateEntries.map((candidate) => candidate.revision);
		const batchOffset = scanOffset;
		const remainingAuthorizationTarget = authorizationTarget - authorizedCount;
		const selectedProjection =
			presentation === "hits"
				? sql`(
			jsonb_build_object(
				'id', ${unit.id},
				'category', ${category}::text,
				'kind', ${hitType},
				'language', ${resolvedUnitLocalizationLanguage(
					unit.id,
					request.localizationLanguages,
					presentationLanguages,
				)},
				'title', case when ${category}::text = 'tag-structures' then (
					select string_agg(
						coalesce(
							${resolvedUnitLocalizationTitle(
								unitStructureMember.memberUnitId,
								request.localizationLanguages,
								presentationLanguages,
							)},
							${unitStructureMember.memberUnitId}::text
						),
						' › ' order by ${unitStructureMember.ordinal}
					)
					from ${unitStructureMember}
					where ${unitStructureMember.structureId} = ${unit.id}
				) else ${resolvedUnitLocalizationTitle(
					unit.id,
					request.localizationLanguages,
					presentationLanguages,
				)} end,
				'summary', ${resolvedUnitLocalizationSummary(
					unit.id,
					request.localizationLanguages,
					presentationLanguages,
				)},
				'titles', case when ${category}::text = 'tag-structures' then coalesce((
					select jsonb_build_array(string_agg(
						coalesce(${firstUnitLocalizationTitle(unitStructureMember.memberUnitId)},
							${unitStructureMember.memberUnitId}::text),
						' › ' order by ${unitStructureMember.ordinal}
					))
					from ${unitStructureMember}
					where ${unitStructureMember.structureId} = ${unit.id}
				), '[]'::jsonb) else coalesce((
					SELECT jsonb_agg(${unitLocalization.title} ORDER BY ${unitLocalization.position}, ${unitLocalization.language})
						FILTER (WHERE ${unitLocalization.title} IS NOT NULL)
					FROM ${unitLocalization}
					WHERE ${unitLocalization.unitId} = ${unit.id}
				), '[]'::jsonb) end,
				'summaries', coalesce((
					SELECT jsonb_agg(${unitLocalization.summary} ORDER BY ${unitLocalization.position}, ${unitLocalization.language})
						FILTER (WHERE ${unitLocalization.summary} IS NOT NULL)
					FROM ${unitLocalization}
					WHERE ${unitLocalization.unitId} = ${unit.id}
				), '[]'::jsonb),
				'avatar', (
					SELECT case ${unitLocalization.avatarType}
						when 'image' then jsonb_build_object(
							'type', 'image',
							'image', jsonb_build_object(
								'id', ${unitLocalization.avatarAssetId},
								'url', '/image-assets/' || ${unitLocalization.avatarAssetId} || '/presentations/avatar/content'
							)
						)
						when 'emoji' then jsonb_build_object(
							'type', 'emoji',
							'emoji', ${unitLocalization.avatarEmoji}
						)
						when 'icon' then jsonb_build_object(
							'type', 'icon',
							'icon', jsonb_build_object(
								'provider', ${FontAwesomeProvider}::text,
								'prefix', ${unitLocalization.avatarIconPrefix},
								'name', ${unitLocalization.avatarIconName}
							)
						)
					end
					FROM ${unitLocalization}
					WHERE ${unitLocalization.unitId} = ${unit.id}
						AND ${unitLocalization.avatarType} IS NOT NULL
						AND ${
							presentationLanguages.length
								? inArray(unitLocalization.language, presentationLanguages)
								: sql`true`
						}
					ORDER BY
						${localizationLanguageOrder(unitLocalization.language, request.localizationLanguages)},
						${unitLocalization.position},
						${unitLocalization.language}
					LIMIT 1
				)
			)
			|| case when ${category}::text = 'units' then jsonb_build_object(
				'variantRole', case
					when exists (
						select 1 from ${unitVariant}
						where ${unitVariant.variantUnitId} = ${unit.id}
					) then 'variant'
					when exists (
						select 1 from ${unitVariant}
						where ${unitVariant.mainUnitId} = ${unit.id}
					) then 'main'
					else 'standalone'
				end
			) else '{}'::jsonb end
			|| case
				when ${category}::text = 'units'
					and ${searchVariantRelationship.variantUnitId} is not null
				then jsonb_build_object(
					'variantMain', case when ${readableSearchMain} then jsonb_build_object(
						'state', 'available',
						'unit', jsonb_build_object(
							'id', ${searchMainUnit.id},
							'type', ${searchMainUnit.kind},
							'language', ${resolvedUnitLocalizationLanguage(searchMainUnit.id, request.localizationLanguages)},
							'title', ${resolvedUnitLocalizationTitle(searchMainUnit.id, request.localizationLanguages)},
							'cover', case when ${localizedSearchMainCoverAssetId} is null then null
								else jsonb_build_object(
									'id', ${localizedSearchMainCoverAssetId},
									'url', '/image-assets/' || ${localizedSearchMainCoverAssetId} || '/presentations/cover/content'
								) end
						)
					) else jsonb_build_object('state', 'unavailable') end
				)
				else '{}'::jsonb
			end
		) AS hit`
				: sql`${unit.id}::text AS id`;
		const result = candidateIds.length
			? await database.execute<{
					hit?: SearchHitWithoutSlugAddress;
					id?: string;
					ordinality: number | string;
				}>(sql`
		WITH search_candidate(unit_id, ordinality, revision) AS (
			SELECT * FROM unnest(
				${toUuidArray(candidateIds)},
				${toIntegerArray(candidatePositions)},
				${toBigIntArray(candidateRevisions)}
			)
		)
		SELECT ${selectedProjection},
		search_candidate.ordinality
		FROM search_candidate
		JOIN ${searchUnitProjectionSource}
			ON ${searchUnitProjectionSource.unitId} = search_candidate.unit_id
			AND ${searchUnitProjectionSource.revision} = search_candidate.revision
		JOIN ${unit} ON ${unit.id} = search_candidate.unit_id
		LEFT JOIN ${profile} ON ${profile.id} = ${unit.id}
		LEFT JOIN ${entity} ON ${entity.id} = ${unit.id}
		LEFT JOIN ${post} ON ${post.id} = ${unit.id}
		LEFT JOIN ${postReply} ON ${postReply.postId} = ${unit.id}
		LEFT JOIN ${postReplyStat} ON ${postReplyStat.postId} = ${unit.id}
		LEFT JOIN ${unitFollowStat} ON ${unitFollowStat.unitId} = ${unit.id}
		LEFT JOIN ${unit} AS ${subjectUnit} ON ${subjectUnit.id} = ${post.subjectUnitId}
		LEFT JOIN ${unitVariant} AS ${searchVariantRelationship}
			ON ${searchVariantRelationship.variantUnitId} = ${unit.id}
		LEFT JOIN ${unit} AS ${searchMainUnit}
			ON ${searchMainUnit.id} = ${searchVariantRelationship.mainUnitId}
		LEFT JOIN ${realm} ON ${realm.id} = ${unit.id}
		LEFT JOIN ${collection} ON ${collection.id} = ${unit.id}
		LEFT JOIN ${poll} ON ${poll.id} = ${unit.id}
		LEFT JOIN ${book} ON ${book.id} = ${unit.id}
		LEFT JOIN ${media} ON ${media.id} = ${unit.id}
		LEFT JOIN ${software} ON ${software.id} = ${unit.id}
		WHERE ${sql.join(conditions, sql` AND `)}
		ORDER BY search_candidate.ordinality
		LIMIT ${remainingAuthorizationTarget}
	`)
			: { rows: [] };
		const authorizationMayBeTruncated =
			result.rows.length === remainingAuthorizationTarget &&
			candidateIds.length > remainingAuthorizationTarget;
		authorizedCount += result.rows.length;
		for (const row of result.rows)
			if (hits.length + identifiers.length < limit) {
				if (presentation === "hits") {
					if (!row.hit) throw new TypeError("PostgreSQL omitted a Search hit projection");
					hits.push(row.hit);
				} else {
					if (!row.id)
						throw new TypeError("PostgreSQL omitted a Search identifier projection");
					identifiers.push({ id: row.id });
				}
				if (hits.length + identifiers.length === limit) {
					const ordinality = Number(row.ordinality);
					if (!Number.isSafeInteger(ordinality) || ordinality < 1)
						throw new TypeError("PostgreSQL returned invalid candidate ordinality");
					pageBoundaryOffset = batchOffset + ordinality;
				}
			}
		scanOffset += candidateResult.hits.length;
		exhausted =
			!authorizationMayBeTruncated &&
			(candidateResult.hits.length < batchLimit ||
				scanOffset >= candidateResult.estimatedTotalHits);
		if (candidateResult.hits.length === 0) exhausted = true;
	}
	const budgetHit =
		!exhausted &&
		(scanOffset - initialOffset >= env.SEARCH_CANDIDATE_SCAN_LIMIT ||
			rounds >= maxCandidateRounds ||
			performance.now() >= candidateDeadline);
	const nextOffset =
		hits.length + identifiers.length === limit &&
		(authorizedCount > hits.length + identifiers.length || !exhausted)
			? pageBoundaryOffset
			: hits.length + identifiers.length < limit && !exhausted
				? scanOffset
				: undefined;
	metrics.searchCandidateScan(
		"current",
		seen.size,
		authorizedCount,
		rounds,
		budgetHit,
		!exhausted,
	);
	const common = {
		total: { kind: exhausted ? "exact" : "lower-bound", value: authorizedCount } as const,
		offset: initialOffset,
		nextOffset: nextOffset ?? scanOffset,
		exhausted: nextOffset === undefined,
		nextCursor:
			nextOffset === undefined
				? undefined
				: createSearchCursor({
						version: 1,
						generationId: candidateContext.generationId,
						requestHash,
						pageSize: limit,
						categories: { [category]: { offset: nextOffset, exhausted: false } },
					}),
		limit,
		processingTimeMs: Math.round((performance.now() - startedAt) * 1000) / 1000,
	};
	return presentation === "hits" ? { ...common, hits } : { ...common, hits: identifiers };
}

export async function searchDomain(
	category: SearchCategory,
	request: DomainSearchRequest,
	candidateContext?: CandidateSearchContext,
) {
	const result = await searchDomainScan(category, request, "hits", candidateContext);
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
	candidateContext?: CandidateSearchContext,
): Promise<SearchDomainScanResult<SearchIdentifier>> {
	return searchDomainScan(category, request, "identifiers", candidateContext);
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
}

/**
 * Executes one globally sorted candidate stream across mutually exclusive categories.
 *
 * Meilisearch establishes the total order. PostgreSQL only removes candidates
 * that fail authoritative access or residual predicates and preserves the
 * engine ordinality of every surviving Unit.
 *
 * @internal
 */
export async function searchGlobalIdentifiers(
	request: GlobalSearchIdentifiersRequest,
	providedCandidateContext?: CandidateSearchContext,
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
	const candidateBranches: CandidateQueryBranch[] = preparedBranches.map(
		({ category, searchExpression }) => ({
			category,
			...(searchExpression ? { expression: searchExpression } : {}),
		}),
	);
	const branchConditions = preparedBranches.map(
		({ category, conditions }) =>
			sql`(search_candidate.category = ${category} and ${sql.join(conditions, sql` and `)})`,
	);
	const sort = request.sort ?? (request.query?.trim() ? "relevance" : "best");
	const candidateContext = await resolveCandidateContext(
		request.profileId,
		providedCandidateContext,
	);
	const domainCandidateFilter = compileCandidateDomainFilter(request.domainFilter);
	const limit = request.limit ?? 20;
	const initialOffset = request.offset ?? 0;
	const identifiers: SearchIdentifier[] = [];
	const seen = new Set<string>();
	let authorizedCount = 0;
	let scanOffset = initialOffset;
	let exhausted = false;
	let rounds = 0;
	let pageBoundaryOffset: number | undefined;
	const authorizationTarget = limit + 1;
	const maxCandidateRounds = env.SEARCH_CANDIDATE_MAX_ROUNDS ?? 4;
	const candidateDeadline = performance.now() + (env.SEARCH_CANDIDATE_TIME_BUDGET_MS ?? 1_500);

	while (
		!exhausted &&
		authorizedCount < authorizationTarget &&
		scanOffset - initialOffset < env.SEARCH_CANDIDATE_SCAN_LIMIT &&
		rounds < maxCandidateRounds &&
		performance.now() < candidateDeadline
	) {
		const batchLimit = Math.min(
			env.SEARCH_CANDIDATE_BATCH_SIZE * 2 ** rounds,
			env.SEARCH_CANDIDATE_SCAN_LIMIT - (scanOffset - initialOffset),
		);
		rounds += 1;
		const [candidateResult] = await searchCandidates([
			{
				indexUid: candidateContext.indexUid,
				accessFilter: candidateContext.accessFilter,
				domainFilter: domainCandidateFilter,
				branches: candidateBranches,
				query: request.query?.trim() ?? "",
				offset: scanOffset,
				limit: batchLimit,
				sort,
			},
		]);
		if (!candidateResult) throw new Error("Meilisearch omitted a candidate result");
		const candidateEntries = candidateResult.hits.flatMap((candidate, index) => {
			if (seen.has(candidate.id)) return [];
			seen.add(candidate.id);
			return [
				{
					id: candidate.id,
					position: index + 1,
					revision: candidate.revision,
					category: candidate.category,
				},
			];
		});
		const batchOffset = scanOffset;
		const remainingAuthorizationTarget = authorizationTarget - authorizedCount;
		const result = candidateEntries.length
			? await database.execute<{
					id: string;
					ordinality: number | string;
				}>(sql`
		WITH search_candidate(unit_id, ordinality, revision, category) AS (
			SELECT * FROM unnest(
				${toUuidArray(candidateEntries.map(({ id }) => id))},
				${toIntegerArray(candidateEntries.map(({ position }) => position))},
				${toBigIntArray(candidateEntries.map(({ revision }) => revision))},
				${toTextArray(candidateEntries.map(({ category }) => category))}
			)
		)
		SELECT ${unit.id}::text AS id, search_candidate.ordinality
		FROM search_candidate
		JOIN ${searchUnitProjectionSource}
			ON ${searchUnitProjectionSource.unitId} = search_candidate.unit_id
			AND ${searchUnitProjectionSource.revision} = search_candidate.revision
		JOIN ${unit} ON ${unit.id} = search_candidate.unit_id
		LEFT JOIN ${profile} ON ${profile.id} = ${unit.id}
		LEFT JOIN ${entity} ON ${entity.id} = ${unit.id}
		LEFT JOIN ${post} ON ${post.id} = ${unit.id}
		LEFT JOIN ${postReply} ON ${postReply.postId} = ${unit.id}
		LEFT JOIN ${postReplyStat} ON ${postReplyStat.postId} = ${unit.id}
		LEFT JOIN ${unitFollowStat} ON ${unitFollowStat.unitId} = ${unit.id}
		LEFT JOIN ${unit} AS ${subjectUnit} ON ${subjectUnit.id} = ${post.subjectUnitId}
		LEFT JOIN ${realm} ON ${realm.id} = ${unit.id}
		LEFT JOIN ${collection} ON ${collection.id} = ${unit.id}
		LEFT JOIN ${poll} ON ${poll.id} = ${unit.id}
		LEFT JOIN ${book} ON ${book.id} = ${unit.id}
		LEFT JOIN ${media} ON ${media.id} = ${unit.id}
		LEFT JOIN ${software} ON ${software.id} = ${unit.id}
		WHERE (${sql.join(branchConditions, sql` or `)})
		ORDER BY search_candidate.ordinality
		LIMIT ${remainingAuthorizationTarget}
	`)
			: { rows: [] };
		const authorizationMayBeTruncated =
			result.rows.length === remainingAuthorizationTarget &&
			candidateEntries.length > remainingAuthorizationTarget;
		authorizedCount += result.rows.length;
		for (const row of result.rows)
			if (identifiers.length < limit) {
				identifiers.push({ id: row.id });
				if (identifiers.length === limit) {
					const ordinality = Number(row.ordinality);
					if (!Number.isSafeInteger(ordinality) || ordinality < 1)
						throw new TypeError("PostgreSQL returned invalid candidate ordinality");
					pageBoundaryOffset = batchOffset + ordinality;
				}
			}
		scanOffset += candidateResult.hits.length;
		exhausted =
			!authorizationMayBeTruncated &&
			(candidateResult.hits.length < batchLimit ||
				scanOffset >= candidateResult.estimatedTotalHits);
		if (candidateResult.hits.length === 0) exhausted = true;
	}
	const budgetHit =
		!exhausted &&
		(scanOffset - initialOffset >= env.SEARCH_CANDIDATE_SCAN_LIMIT ||
			rounds >= maxCandidateRounds ||
			performance.now() >= candidateDeadline);
	const nextOffset =
		identifiers.length === limit && (authorizedCount > identifiers.length || !exhausted)
			? pageBoundaryOffset
			: identifiers.length < limit && !exhausted
				? scanOffset
				: undefined;
	metrics.searchCandidateScan(
		"current",
		seen.size,
		authorizedCount,
		rounds,
		budgetHit,
		!exhausted,
	);
	return {
		hits: identifiers,
		total: { kind: exhausted ? "exact" : "lower-bound", value: authorizedCount },
		offset: initialOffset,
		nextOffset: nextOffset ?? scanOffset,
		exhausted: nextOffset === undefined,
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
	providedCandidateContext?: CandidateSearchContext,
): Promise<SearchFacet[]> {
	if (!fields.length) return [];
	const requestedFacets = fields.flatMap((field) => {
		const spec = facetSpec(category, field);
		return spec ? [{ field, spec }] : [];
	});
	if (!requestedFacets.length) return [];
	const searchExpression = buildEffectiveSearchExpression(request);
	const conditions = buildSearchConditions(category, request, searchExpression);
	const candidateContext = await resolveCandidateContext(
		request.profileId,
		providedCandidateContext,
	);
	const domainCandidateFilter = compileCandidateDomainFilter(request.domainFilter);
	const candidateLimit = env.SEARCH_FACET_CANDIDATE_SCAN_LIMIT;
	const [candidateResult] = await searchCandidates([
		{
			indexUid: candidateContext.indexUid,
			accessFilter: candidateContext.accessFilter,
			domainFilter: domainCandidateFilter,
			category,
			query: request.query?.trim() ?? "",
			offset: 0,
			limit: candidateLimit,
			expression: searchExpression,
			sort: request.sort ?? (request.query?.trim() ? "relevance" : "best"),
		},
	]);
	if (!candidateResult) throw new Error("Meilisearch omitted a facet candidate result");
	const candidates = new Map<string, number>();
	for (const candidate of candidateResult.hits)
		if (!candidates.has(candidate.id)) candidates.set(candidate.id, candidate.revision);
	const exhausted =
		candidateResult.hits.length < candidateLimit ||
		candidateResult.hits.length >= candidateResult.estimatedTotalHits;
	metrics.searchFacetScan(
		"current",
		candidates.size,
		candidateResult.hits.length ? 1 : 0,
		!exhausted,
	);
	if (!candidates.size) return [];
	const candidateIds = [...candidates.keys()];
	const candidateRevisions = [...candidates.values()];
	const queries = requestedFacets.map(
		({ field, spec }) =>
			sql`(
				select ${field}::text as field, (${spec.value})::text as value,
				count(distinct ${unit.id})::text as count
			from search_candidate
			join ${searchUnitProjectionSource}
				on ${searchUnitProjectionSource.unitId} = search_candidate.unit_id
				and ${searchUnitProjectionSource.revision} = search_candidate.revision
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
		sql`with search_candidate(unit_id, revision) as (
			select * from unnest(
				${toUuidArray(candidateIds)},
				${toBigIntArray(candidateRevisions)}
			)
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
	await getActiveSearchGeneration("current");
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
