import { sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { database } from "../database";
import {
	collection,
	entity,
	poll,
	pollOption,
	post,
	postReply,
	profile,
	profileFollow,
	realm,
	realmContent,
	realmSubscription,
	unit,
	unitLocalization,
} from "../database/schema";
import { InvalidSearch } from "./errors";
import {
	SearchCategoryRules,
	type DomainSearchRequest,
	type SearchCategory,
	type SearchHit,
	type SearchSort,
} from "./schema";

const subjectUnit = alias(unit, "subject_unit");

const categoryKinds: Record<SearchCategory, readonly string[]> = {
	units: ["book", "game", "media"],
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
		SELECT ${profile.id}
		FROM ${profile}
		WHERE ${profile.name} &@~ pgroonga_query_escape(${query})
			OR ${profile.summary} &@~ pgroonga_query_escape(${query})
			OR ${profile.description} &@~ pgroonga_query_escape(${query})
		UNION
		SELECT ${pollOption.pollId}
		FROM ${pollOption}
		WHERE ${pollOption.deletedAt} IS NULL
			AND ${pollOption.label} &@~ pgroonga_query_escape(${query})
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
			FROM ${profileFollow}
			WHERE ${profileFollow.followedProfileId} = ${unit.id}
		) ${direction}`;
	if (sort.startsWith("subscriberCount:") && category === "realms")
		return sql`(
			SELECT count(*)
			FROM ${realmSubscription}
			WHERE ${realmSubscription.realmId} = ${unit.id}
		) ${direction}`;
	throw new InvalidSearch(`${sort} is not supported by the ${category} category`);
}

export async function searchDomain(category: SearchCategory, request: DomainSearchRequest) {
	const startedAt = performance.now();
	validateRequest(category, request);

	const conditions: SQL[] = [
		sql`${unit.status} = 'published'`,
		sql`${unit.visibility} = 'public'`,
		sql`${unit.deletedAt} IS NULL`,
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
			SELECT 1 FROM ${realmContent}
			WHERE ${realmContent.unitId} = ${unit.id}
				AND ${realmContent.realmId} = ${request.realmId}::uuid
		)`);
	}
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
				SELECT jsonb_agg(${unitLocalization.title} ORDER BY ${unitLocalization.isDefault} DESC, ${unitLocalization.language})
					FILTER (WHERE ${unitLocalization.title} IS NOT NULL)
				FROM ${unitLocalization}
				WHERE ${unitLocalization.unitId} = ${unit.id}
			), '[]'::jsonb),
			'summaries', coalesce((
				SELECT jsonb_agg(${unitLocalization.summary} ORDER BY ${unitLocalization.isDefault} DESC, ${unitLocalization.language})
					FILTER (WHERE ${unitLocalization.summary} IS NOT NULL)
				FROM ${unitLocalization}
				WHERE ${unitLocalization.unitId} = ${unit.id}
			), '[]'::jsonb),
			'name', ${profile.name},
			'summary', ${profile.summary}
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

export async function searchGrouped(request: {
	query?: string;
	indexes: SearchCategory[];
	Languages?: string[];
	limitPerIndex?: number;
}) {
	const groups = [];
	for (const category of request.indexes) {
		const result = await searchDomain(category, {
			query: request.query,
			Languages: request.Languages,
			limit: request.limitPerIndex ?? 5,
		});
		groups.push({ index: category, ...result });
	}
	return { query: request.query ?? "", groups };
}
