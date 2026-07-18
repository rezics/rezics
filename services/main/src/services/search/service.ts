import { sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { SearchExpression, SearchFilter, SearchScalar } from "@rezics/search";

import { getUnitReadCondition } from "../authorization/unit/query";
import { database } from "../database";
import {
	collection,
	contentStructureNode,
	entity,
	poll,
	post,
	postReply,
	profile,
	unitFollow,
	realm,
	realmUnit,
	unit,
	unitAlias,
	unitAliasVote,
	unitLocalization,
	unitTag,
} from "../database/schema";
import { AliasSearchScoreThreshold } from "../database/schema/contract-values";
import { InvalidSearch } from "./errors";
import {
	SearchCategoryRules,
	type DomainSearchRequest,
	type SearchCategory,
	type SearchHit,
	type SearchSort,
} from "./schema";

const subjectUnit = alias(unit, "subject_unit");
const facetLocalization = alias(unitLocalization, "facet_unit_localization");
const facetUnitTag = alias(unitTag, "facet_unit_tag");
const facetRealmUnit = alias(realmUnit, "facet_realm_unit");

const categoryKinds: Record<SearchCategory, readonly string[]> = {
	units: ["book", "software", "media"],
	users: ["profile"],
	entity: ["entity"],
	tags: ["tag"],
	posts: ["post"],
	realms: ["realm"],
	collections: ["collection"],
	reviews: ["post"],
	polls: ["poll"],
};

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

function addList(conditions: SQL[], column: SQL, values: string[] | undefined): void {
	if (values?.length) conditions.push(sql`(${column})::text = ANY(${toTextArray(values)})`);
}

function supportsFilter(category: SearchCategory, attribute: string): boolean {
	return (SearchCategoryRules[category].filterableAttributes as readonly string[]).includes(
		attribute,
	);
}

function supportsSort(category: SearchCategory, attribute: string): boolean {
	return (SearchCategoryRules[category].sortableAttributes as readonly string[]).includes(
		attribute,
	);
}

function validateRequest(category: SearchCategory, request: DomainSearchRequest): void {
	const filters = [
		["Languages", "Languages", Boolean(request.Languages?.length)],
		["types", "type", Boolean(request.types?.length)],
		["contentRatings", "contentRating", Boolean(request.contentRatings?.length)],
		["aiDisclosures", "aiDisclosure", Boolean(request.aiDisclosures?.length)],
		["licenses", "license", Boolean(request.licenses?.length)],
		["authorId", "authorId", Boolean(request.authorId)],
		["realmId", "realmId", Boolean(request.realmId)],
		["subjectId", "subjectId", Boolean(request.subjectId)],
		["targetId", "targetId", Boolean(request.targetId)],
		["rootId", "rootId", Boolean(request.rootId)],
		["parentId", "parentId", Boolean(request.parentId)],
		["ownerId", "ownerId", Boolean(request.ownerId)],
		["joinPolicies", "joinPolicy", Boolean(request.joinPolicies?.length)],
		["multiple", "multiple", request.multiple !== undefined],
		["resultsVisibilities", "resultsVisibility", Boolean(request.resultsVisibilities?.length)],
		["closed", "closesAt", request.closed !== undefined],
	] as const;
	for (const [key, attribute, present] of filters)
		if (present && !supportsFilter(category, attribute))
			throw new InvalidSearch(`${key} is not supported by the ${category} category`);

	const sort = request.sort ?? "relevance";
	const attribute = sort.split(":", 1)[0]!;
	if (sort !== "relevance" && !supportsSort(category, attribute))
		throw new InvalidSearch(`${sort} is not supported by the ${category} category`);
}

function scalarStrings(values: readonly SearchScalar[], field: string): string[] {
	if (values.some((value) => typeof value !== "string"))
		throw new InvalidSearch(`${field} requires string values`);
	return values as string[];
}

function filterValues(filter: SearchFilter): readonly SearchScalar[] {
	if ("values" in filter) return filter.values;
	if ("value" in filter) return [filter.value];
	return [filter.lower, filter.upper].filter(
		(value): value is SearchScalar => value !== undefined,
	);
}

function scalarColumnCondition(column: SQL, filter: SearchFilter): SQL {
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
	const values = scalarStrings(filterValues(filter), filter.field);
	if (filter.operator === "all-of" && values.length > 1)
		throw new InvalidSearch(`${filter.field} cannot equal multiple values`);
	const match = sql`(${column})::text = any(${toTextArray(values)})`;
	return filter.operator === "not-equals" || filter.operator === "none-of"
		? sql`not (${match})`
		: match;
}

function compileFilter(category: SearchCategory, filter: SearchFilter): SQL {
	if (filter.field === "category") {
		const values = scalarStrings(filterValues(filter), filter.field);
		const matches = values.includes(category);
		if (filter.operator === "not-equals" || filter.operator === "none-of")
			return sql`${!matches}`;
		return sql`${matches}`;
	}

	const fieldAttribute: Partial<Record<SearchFilter["field"], string>> = {
		language: "Languages",
		type: "type",
		"content-rating": "contentRating",
		"ai-disclosure": "aiDisclosure",
		license: "license",
		tag: "tagId",
		author: "authorId",
		realm: "realmId",
		subject: "subjectId",
		target: "targetId",
		root: "rootId",
		parent: "parentId",
		owner: "ownerId",
		"join-policy": "joinPolicy",
		multiple: "multiple",
		"results-visibility": "resultsVisibility",
		closed: "closesAt",
	};
	const attribute = fieldAttribute[filter.field];
	const dateField = ["created-at", "updated-at", "published-at", "closes-at"].includes(
		filter.field,
	);
	if (filter.field === "closes-at" && category !== "polls")
		throw new InvalidSearch(`closes-at is not supported by the ${category} category`);
	if (!dateField && (!attribute || !supportsFilter(category, attribute)))
		throw new InvalidSearch(`${filter.field} is not supported by the ${category} category`);

	if (filter.field === "language") {
		const values = scalarStrings(filterValues(filter), filter.field);
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
	if (filter.field === "tag") {
		const values = scalarStrings(filterValues(filter), filter.field);
		const match =
			filter.operator === "all-of"
				? sql`array(
					select ${unitTag.tagId} from ${unitTag} where ${unitTag.unitId} = ${unit.id}
				) @> ${toUuidArray(values)}`
				: sql`exists (
					select 1 from ${unitTag}
					where ${unitTag.unitId} = ${unit.id}
						and ${unitTag.tagId} = any(${toUuidArray(values)})
				)`;
		return filter.operator === "not-equals" || filter.operator === "none-of"
			? sql`not (${match})`
			: match;
	}
	if (filter.field === "realm") {
		const values = scalarStrings(filterValues(filter), filter.field);
		const match = sql`exists (
			select 1 from ${realmUnit}
			where ${realmUnit.unitId} = ${unit.id}
				and ${realmUnit.realmId} = any(${toUuidArray(values)})
				and ${realmUnit.status} = 'visible'
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

	const columnByField: Partial<Record<SearchFilter["field"], SQL>> = {
		type:
			category === "entity"
				? sql`${entity.kind}`
				: category === "reviews"
					? sql`${subjectUnit.kind}`
					: sql`${unit.kind}`,
		"content-rating": sql`${unit.contentRating}`,
		"ai-disclosure": sql`${unit.aiDisclosure}`,
		license: sql`${unit.license}`,
		author: sql`${post.authorProfileId}`,
		subject: sql`${post.subjectUnitId}`,
		target: sql`${post.subjectUnitId}`,
		root: sql`${postReply.rootPostId}`,
		parent: sql`${postReply.parentPostId}`,
		owner: sql`${collection.ownerProfileId}`,
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

function compileExpression(category: SearchCategory, expression: SearchExpression): SQL {
	if ("field" in expression) return compileFilter(category, expression);
	if (expression.operator === "not")
		return sql`not (${compileExpression(category, expression.clause)})`;
	const clauses = expression.clauses.map((clause) => compileExpression(category, clause));
	return sql`(${sql.join(clauses, expression.operator === "all" ? sql` and ` : sql` or `)})`;
}

function getUnitCandidateIds(query: string): SQL {
	return sql`(
		SELECT ${unitLocalization.unitId}
		FROM ${unitLocalization}
		WHERE ${unitLocalization.title} &@~ pgroonga_query_escape(${query})
			OR ${unitLocalization.summary} &@~ pgroonga_query_escape(${query})
			OR ${unitLocalization.description} &@~ pgroonga_query_escape(${query})
			OR (
				${unitLocalization.contentStatus} = 'published'
				AND ${unitLocalization.content} &@~ pgroonga_query_escape(${query})
			)
		UNION
		SELECT ${unitAlias.unitId}
		FROM ${unitAlias}
		WHERE ${unitAlias.deletedAt} IS NULL
			AND ${unitAlias.term} &@~ pgroonga_query_escape(${query})
			AND (
				SELECT coalesce(sum(${unitAliasVote.value}), 0)
				FROM ${unitAliasVote}
				WHERE ${unitAliasVote.aliasId} = ${unitAlias.id}
			) >= ${AliasSearchScoreThreshold}
		UNION
		SELECT ${unit.id}
		FROM ${unit}
		WHERE ${unit.deletedAt} IS NULL
			AND ${unit.slug} &@~ pgroonga_query_escape(${query})
	)`;
}

function getSort(category: SearchCategory, sort: SearchSort): SQL {
	if (sort === "relevance") return sql`${unit.updatedAt} DESC`;
	const ascending = sort.endsWith(":asc");
	const direction = ascending ? sql`ASC` : sql`DESC`;
	if (sort.startsWith("createdAt:")) return sql`${unit.createdAt} ${direction}`;
	if (sort.startsWith("updatedAt:")) return sql`${unit.updatedAt} ${direction}`;
	if (sort.startsWith("publishedAt:")) return sql`${unit.publishedAt} ${direction} NULLS LAST`;
	if (sort.startsWith("closesAt:")) return sql`${poll.closesAt} ${direction} NULLS LAST`;
	if (sort.startsWith("replyCount:"))
		return sql`(
			SELECT count(*)
			FROM ${postReply}
			JOIN unit reply_unit ON reply_unit.id = ${postReply.postId}
			WHERE reply_unit.deleted_at IS NULL AND (
				(${post.kind} = 'post'::post_kind AND ${postReply.rootPostId} = ${unit.id})
				OR (${post.kind} = 'reply'::post_kind AND ${postReply.parentPostId} = ${unit.id})
			)
		) ${direction}`;
	if (sort.startsWith("subscriberCount:") && category === "users")
		return sql`(
			SELECT count(*)
			FROM ${unitFollow}
			WHERE ${unitFollow.unitId} = ${unit.id}
		) ${direction}`;
	if (sort.startsWith("subscriberCount:") && category === "realms")
		return sql`(
			SELECT count(*)
			FROM ${unitFollow}
			WHERE ${unitFollow.unitId} = ${unit.id}
		) ${direction}`;
	throw new InvalidSearch(`${sort} is not supported by the ${category} category`);
}

function buildSearchConditions(category: SearchCategory, request: DomainSearchRequest): SQL[] {
	validateRequest(category, request);
	const readCondition = getUnitReadCondition(request.profileId, { discoverableOnly: true });
	if (!readCondition) throw new Error("Unit read policy produced no SQL condition");

	const conditions: SQL[] = [
		readCondition,
		sql`${unit.kind}::text = ANY(${toTextArray(categoryKinds[category])})`,
	];
	if (category === "posts")
		conditions.push(sql`${post.kind} in ('post'::post_kind, 'reply'::post_kind)`);
	if (category === "reviews") conditions.push(sql`${post.kind} = 'review'`);

	const query = request.query?.trim() ?? "";
	if (query) conditions.push(sql`${unit.id} IN ${getUnitCandidateIds(query)}`);
	if (request.Languages?.length)
		conditions.push(sql`(
			NOT EXISTS (
				SELECT 1 FROM ${unitLocalization}
				WHERE ${unitLocalization.unitId} = ${unit.id}
			)
			OR EXISTS (
				SELECT 1 FROM ${unitLocalization}
				WHERE ${unitLocalization.unitId} = ${unit.id}
					AND ${unitLocalization.language} = ANY(${toTextArray(request.Languages)})
			)
		)`);

	if (request.types?.length) {
		const column =
			category === "entity"
				? sql`${entity.kind}`
				: category === "reviews"
					? sql`${subjectUnit.kind}`
					: sql`${unit.kind}`;
		addList(conditions, column, request.types);
	}
	const unitListFilters = [
		[sql`${unit.contentRating}`, request.contentRatings],
		[sql`${unit.aiDisclosure}`, request.aiDisclosures],
		[sql`${unit.license}`, request.licenses],
		[sql`${poll.resultVisibility}`, request.resultsVisibilities],
	] as const;
	for (const [column, values] of unitListFilters) {
		if (!values?.length) continue;
		addList(conditions, column, values);
	}

	if (request.joinPolicies?.length) {
		addList(conditions, sql`${realm.joinPolicy}`, request.joinPolicies);
	}

	const scalarFilters = [
		[sql`${post.authorProfileId}`, request.authorId],
		[sql`${post.subjectUnitId}`, request.subjectId],
		[sql`${post.subjectUnitId}`, request.targetId],
		[sql`${postReply.rootPostId}`, request.rootId],
		[sql`${postReply.parentPostId}`, request.parentId],
		[sql`${collection.ownerProfileId}`, request.ownerId],
	] as const;
	for (const [column, value] of scalarFilters) {
		if (!value) continue;
		conditions.push(sql`${column} = ${value}::uuid`);
	}
	if (request.realmId) {
		conditions.push(sql`EXISTS (
			SELECT 1 FROM ${realmUnit}
			WHERE ${realmUnit.unitId} = ${unit.id}
				AND ${realmUnit.realmId} = ${request.realmId}::uuid
				AND ${realmUnit.status} = 'visible'
		)`);
	}
	if (request.scopeUnitId) {
		const direct = sql`${unit.id} = ${request.scopeUnitId}::uuid`;
		conditions.push(
			request.includeScopeDescendants
				? sql`(${direct} or exists (
					select 1 from ${contentStructureNode}
					where ${contentStructureNode.ownerUnitId} = ${request.scopeUnitId}::uuid
						and ${contentStructureNode.contentUnitId} = ${unit.id}
						and ${contentStructureNode.deletedAt} is null
				))`
				: direct,
		);
	}
	if (request.expression) conditions.push(compileExpression(category, request.expression));
	if (request.multiple !== undefined) {
		conditions.push(sql`(${poll.mode} = 'multiple') = ${request.multiple}`);
	}
	if (request.closed !== undefined) {
		conditions.push(
			request.closed
				? sql`(${poll.closedAt} IS NOT NULL OR ${poll.closesAt} <= now())`
				: sql`(${poll.closedAt} IS NULL AND (${poll.closesAt} IS NULL OR ${poll.closesAt} > now()))`,
		);
	}
	return conditions;
}

export async function searchDomain(category: SearchCategory, request: DomainSearchRequest) {
	const startedAt = performance.now();
	const conditions = buildSearchConditions(category, request);

	const sort = request.sort ?? "relevance";
	const order = getSort(category, sort);
	const offset = request.offset ?? 0;
	const limit = request.limit ?? 20;
	const hitType = category === "posts" ? sql`${post.kind}::text` : sql`${unit.kind}::text`;
	const result = await database.execute<{ hit: SearchHit; total: string }>(sql`
		SELECT jsonb_strip_nulls(jsonb_build_object(
			'id', ${unit.id},
			'kind', ${category}::text,
			'type', ${hitType},
			'slug', ${unit.slug},
			'titles', coalesce((
				SELECT jsonb_agg(${unitLocalization.title} ORDER BY ${unitLocalization.position}, ${unitLocalization.language})
					FILTER (WHERE ${unitLocalization.title} IS NOT NULL)
				FROM ${unitLocalization}
				WHERE ${unitLocalization.unitId} = ${unit.id}
			), '[]'::jsonb),
			'summaries', coalesce((
				SELECT jsonb_agg(${unitLocalization.summary} ORDER BY ${unitLocalization.position}, ${unitLocalization.language})
					FILTER (WHERE ${unitLocalization.summary} IS NOT NULL)
				FROM ${unitLocalization}
				WHERE ${unitLocalization.unitId} = ${unit.id}
			), '[]'::jsonb)
		)) AS hit, count(*) OVER ()::text AS total
		FROM ${unit}
		LEFT JOIN ${profile} ON ${profile.id} = ${unit.id}
		LEFT JOIN ${entity} ON ${entity.id} = ${unit.id}
		LEFT JOIN ${post} ON ${post.id} = ${unit.id}
		LEFT JOIN ${postReply} ON ${postReply.postId} = ${unit.id}
		LEFT JOIN ${unit} AS ${subjectUnit} ON ${subjectUnit.id} = ${post.subjectUnitId}
		LEFT JOIN ${realm} ON ${realm.id} = ${unit.id}
		LEFT JOIN ${collection} ON ${collection.id} = ${unit.id}
		LEFT JOIN ${poll} ON ${poll.id} = ${unit.id}
		WHERE ${sql.join(conditions, sql` AND `)}
		ORDER BY ${order}, ${unit.id}
		OFFSET ${offset} LIMIT ${limit}
	`);
	return {
		hits: result.rows.map((row) => row.hit),
		total: result.rows[0] ? Number(result.rows[0].total) : 0,
		offset,
		limit,
		processingTimeMs: Math.round((performance.now() - startedAt) * 1000) / 1000,
	};
}

export interface SearchFacet {
	readonly field: string;
	readonly options: readonly { readonly value: string; readonly count: number }[];
}

function facetSpec(
	category: SearchCategory,
	field: string,
): { readonly value: SQL; readonly join: SQL } | undefined {
	const none = sql``;
	if (field === "category") return { value: sql`${category}::text`, join: none };
	if (field === "language")
		return {
			value: sql`${facetLocalization.language}`,
			join: sql`join ${facetLocalization} on ${facetLocalization.unitId} = ${unit.id}`,
		};
	if (field === "tag")
		return {
			value: sql`${facetUnitTag.tagId}`,
			join: sql`join ${facetUnitTag} on ${facetUnitTag.unitId} = ${unit.id}`,
		};
	if (field === "realm")
		return {
			value: sql`${facetRealmUnit.realmId}`,
			join: sql`join ${facetRealmUnit} on ${facetRealmUnit.unitId} = ${unit.id} and ${facetRealmUnit.status} = 'visible'`,
		};
	if (field === "type")
		return {
			value:
				category === "entity"
					? sql`${entity.kind}`
					: category === "reviews"
						? sql`${subjectUnit.kind}`
						: category === "posts"
							? sql`${post.kind}`
							: sql`${unit.kind}`,
			join: none,
		};
	const scalar: Partial<Record<string, { readonly attribute: string; readonly value: SQL }>> = {
		"content-rating": { attribute: "contentRating", value: sql`${unit.contentRating}` },
		"ai-disclosure": { attribute: "aiDisclosure", value: sql`${unit.aiDisclosure}` },
		license: { attribute: "license", value: sql`${unit.license}` },
		author: { attribute: "authorId", value: sql`${post.authorProfileId}` },
		owner: { attribute: "ownerId", value: sql`${collection.ownerProfileId}` },
		"join-policy": { attribute: "joinPolicy", value: sql`${realm.joinPolicy}` },
		multiple: { attribute: "multiple", value: sql`${poll.mode} = 'multiple'` },
		"results-visibility": {
			attribute: "resultsVisibility",
			value: sql`${poll.resultVisibility}`,
		},
		closed: {
			attribute: "closesAt",
			value: sql`${poll.closedAt} is not null or ${poll.closesAt} <= now()`,
		},
	};
	const spec = scalar[field];
	return spec && supportsFilter(category, spec.attribute)
		? { value: spec.value, join: none }
		: undefined;
}

/** Conjunctive facet counts for the effective configured request, batched per category. */
export async function searchDomainFacets(
	category: SearchCategory,
	request: DomainSearchRequest,
	fields: readonly string[],
): Promise<SearchFacet[]> {
	const conditions = buildSearchConditions(category, request);
	const queries = fields.flatMap((field) => {
		const spec = facetSpec(category, field);
		if (!spec) return [];
		return [
			sql`(
			select ${field}::text as field, (${spec.value})::text as value,
				count(distinct ${unit.id})::text as count
			from ${unit}
			left join ${profile} on ${profile.id} = ${unit.id}
			left join ${entity} on ${entity.id} = ${unit.id}
			left join ${post} on ${post.id} = ${unit.id}
			left join ${postReply} on ${postReply.postId} = ${unit.id}
			left join ${unit} as ${subjectUnit} on ${subjectUnit.id} = ${post.subjectUnitId}
			left join ${realm} on ${realm.id} = ${unit.id}
			left join ${collection} on ${collection.id} = ${unit.id}
			left join ${poll} on ${poll.id} = ${unit.id}
			${spec.join}
			where ${sql.join(conditions, sql` and `)} and (${spec.value}) is not null
			group by (${spec.value})
			order by count(distinct ${unit.id}) desc, (${spec.value})::text
			limit 100
		)`,
		];
	});
	if (!queries.length) return [];
	const result = await database.execute<{ field: string; value: string; count: string }>(
		sql.join(queries, sql` union all `),
	);
	const byField = new Map<string, { value: string; count: number }[]>();
	for (const row of result.rows) {
		const options = byField.get(row.field) ?? [];
		options.push({ value: row.value, count: Number(row.count) });
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
	Languages?: string[];
	limitPerIndex?: number;
}) {
	const groups = [];
	for (const category of request.indexes) {
		const result = await searchDomain(category, {
			profileId: request.profileId,
			query: request.query,
			Languages: request.Languages,
			limit: request.limitPerIndex ?? 5,
		});
		groups.push({ index: category, ...result });
	}
	return { query: request.query ?? "", groups };
}
