import type { SearchExpression, SearchFilter, SearchScalar } from "@rezics/search";
import { getActiveObservability } from "@rezics/observability";
import { sql } from "drizzle-orm";

import { env } from "../config";
import { database } from "../database";
import { InvalidSearch, SearchUnavailable } from "./errors";
import { CurrentSearchFieldRegistry, type SearchFieldDefinition } from "./field-registry";
import type { SearchCategory, SearchSort } from "./schema";

const { metrics } = getActiveObservability();

export interface MeilisearchCandidate {
	readonly id: string;
	readonly revision: number;
	readonly category: string;
	readonly unitType: string;
}

export interface CandidateQuery {
	readonly indexUid: string;
	readonly category: SearchCategory;
	readonly query: string;
	readonly offset: number;
	readonly limit: number;
	readonly profileId?: string;
	readonly expression?: SearchExpression;
	readonly sort: SearchSort;
}

export interface CandidateResult {
	readonly hits: readonly MeilisearchCandidate[];
	readonly estimatedTotalHits: number;
	readonly processingTimeMs: number;
}

function literal(value: SearchScalar, definition: SearchFieldDefinition): string {
	if (definition.scalar === "date") {
		if (typeof value !== "string")
			throw new InvalidSearch(`${definition.documentPath} requires an ISO date-time`);
		const timestamp = Date.parse(value);
		if (!Number.isFinite(timestamp))
			throw new InvalidSearch(`${definition.documentPath} requires an ISO date-time`);
		return String(Math.floor(timestamp / 1_000));
	}
	if (typeof value === "string") return JSON.stringify(value);
	return String(value);
}

function valuesOf(filter: SearchFilter): readonly SearchScalar[] {
	if (filter.field === "realm-tag-vote") return [];
	if ("values" in filter) return filter.values;
	if ("value" in filter) return [filter.value];
	return [filter.lower, filter.upper].filter(
		(value): value is SearchScalar => value !== undefined,
	);
}

function compileOneFilter(category: SearchCategory, filter: SearchFilter): string | undefined {
	const definition = CurrentSearchFieldRegistry[filter.field];
	if (!definition || !definition.categories.includes(category))
		throw new InvalidSearch(`${filter.field} is not supported by the ${category} category`);
	if (!(definition.operators as readonly string[]).includes(filter.operator))
		throw new InvalidSearch(`${filter.operator} is not supported for ${filter.field}`);
	// A residual-only field cannot be safely pushed through arbitrary NOT/OR trees.
	// Omitting the entire expression keeps the engine stage a strict superset.
	if (definition.meilisearch.length === 0) return undefined;
	const path = definition.documentPath;
	let predicate: string;
	if (filter.field === "realm-tag-vote") {
		// Aggregate bounds are authoritative PostgreSQL residuals. Pushing only the
		// context key would be unsafe below NOT or OR, so bound queries skip pushdown.
		if (filter.score || filter.voteCount) return undefined;
		const key = `${filter.realmId.toLowerCase()}:${filter.tagId.toLowerCase()}`;
		predicate = `${path} = ${JSON.stringify(key)}`;
	} else if (filter.operator === "exists") {
		predicate = `${path} ${filter.value ? "EXISTS" : "NOT EXISTS"}`;
	} else if (filter.operator === "range") {
		const bounds: string[] = [];
		if (filter.lower !== undefined)
			bounds.push(`${path} >= ${literal(filter.lower, definition)}`);
		if (filter.upper !== undefined)
			bounds.push(`${path} <= ${literal(filter.upper, definition)}`);
		predicate = bounds.join(" AND ");
	} else {
		const values = valuesOf(filter);
		if (filter.operator === "all-of")
			predicate = values
				.map((value) => `${path} = ${literal(value, definition)}`)
				.join(" AND ");
		else if (filter.operator === "any-of" || filter.operator === "none-of")
			predicate = `${path} ${filter.operator === "none-of" ? "NOT IN" : "IN"} [${values.map((value) => literal(value, definition)).join(", ")}]`;
		else {
			const value = values[0];
			if (value === undefined) throw new InvalidSearch(`${filter.field} requires a value`);
			predicate = `${path} ${filter.operator === "not-equals" ? "!=" : "="} ${literal(value, definition)}`;
		}
	}
	if (definition.unitTypes?.length)
		return `(unitType IN [${definition.unitTypes.map((value) => JSON.stringify(value)).join(", ")}] AND (${predicate}))`;
	return `(${predicate})`;
}

export function compileMeilisearchExpression(
	category: SearchCategory,
	expression: SearchExpression,
): string | undefined {
	if ("field" in expression) return compileOneFilter(category, expression);
	if (expression.operator === "not") {
		const clause = compileMeilisearchExpression(category, expression.clause);
		return clause ? `NOT (${clause})` : undefined;
	}
	const operator = expression.operator === "all" ? " AND " : " OR ";
	const clauses = expression.clauses.map((clause) =>
		compileMeilisearchExpression(category, clause),
	);
	if (clauses.some((clause) => clause === undefined)) return undefined;
	return `(${clauses.join(operator)})`;
}

async function coarseAccessFilter(profileId: string | undefined): Promise<string | undefined> {
	if (!profileId) return "access.publicDiscoverable = true";
	const context = await database.execute<{ realm_ids: string[]; platform_editor: boolean }>(
		sql`select coalesce(array_agg(distinct realm_id) filter (where realm_id is not null), array[]::uuid[])::text[] as realm_ids,
				exists(select 1 from capability_grant where authority = 'platform' and profile_id = ${profileId}::uuid and capability = 'unit.edit' and revoked_at is null and (expires_at is null or expires_at > now())) as platform_editor
			from realm_member where profile_id = ${profileId}::uuid and state = 'active'`,
	);
	const row = context.rows[0];
	if (row?.platform_editor) return undefined;
	const terms = [
		"access.publicDiscoverable = true",
		"access.authenticated = true",
		`access.profileIds = ${JSON.stringify(profileId)}`,
		...(row?.realm_ids ?? []).map((realmId) => `access.realmIds = ${JSON.stringify(realmId)}`),
	];
	return `(${terms.join(" OR ")})`;
}

function meilisearchSort(sort: SearchSort, hasQuery: boolean): string[] {
	if (sort === "relevance")
		return hasQuery
			? []
			: ["ranking.recommendationBest:desc", "ranking.updatedAt:desc", "id:asc"];
	const separator = sort.lastIndexOf(":");
	const field = sort.slice(0, separator);
	const direction = sort.endsWith(":desc") ? "desc" : "asc";
	const path: Record<string, string> = {
		createdAt: "ranking.createdAt",
		updatedAt: "ranking.updatedAt",
		publishedAt: "ranking.publishedAt",
		followerCount: "ranking.followerCount",
		replyCount: "ranking.replyCount",
		closesAt: "filters.closesAt",
	};
	const attribute = path[field];
	if (!attribute) throw new InvalidSearch(`Unsupported search sort ${sort}`);
	return [`${attribute}:${direction}`, "id:asc"];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseCandidateResult(value: unknown): CandidateResult {
	if (!isRecord(value) || !Array.isArray(value.hits))
		throw new SearchUnavailable(new TypeError("Invalid Meilisearch response"));
	const hits = value.hits.map((hit): MeilisearchCandidate => {
		if (
			!isRecord(hit) ||
			typeof hit.id !== "string" ||
			typeof hit.revision !== "number" ||
			!Number.isSafeInteger(hit.revision) ||
			hit.revision < 1 ||
			typeof hit.category !== "string" ||
			typeof hit.unitType !== "string"
		)
			throw new SearchUnavailable(new TypeError("Invalid Meilisearch candidate"));
		return {
			id: hit.id,
			revision: hit.revision,
			category: hit.category,
			unitType: hit.unitType,
		};
	});
	return {
		hits,
		estimatedTotalHits:
			typeof value.estimatedTotalHits === "number" ? value.estimatedTotalHits : hits.length,
		processingTimeMs: typeof value.processingTimeMs === "number" ? value.processingTimeMs : 0,
	};
}

async function executeCandidateSearch(
	queries: readonly CandidateQuery[],
): Promise<CandidateResult[]> {
	if (!env.MEILISEARCH_URL || !env.MEILISEARCH_QUERY_KEY)
		throw new SearchUnavailable(new Error("Meilisearch query configuration is missing"));
	const meilisearchUrl = env.MEILISEARCH_URL;
	const queryKey = env.MEILISEARCH_QUERY_KEY;
	const accessByProfile = new Map<string, Promise<string | undefined>>();
	const requests = await Promise.all(
		queries.map(async (query) => {
			const accessKey = query.profileId ?? "anonymous";
			let accessPromise = accessByProfile.get(accessKey);
			if (!accessPromise) {
				accessPromise = coarseAccessFilter(query.profileId);
				accessByProfile.set(accessKey, accessPromise);
			}
			const access = await accessPromise;
			const filters = [
				`category = ${JSON.stringify(query.category)}`,
				access,
				query.expression
					? compileMeilisearchExpression(query.category, query.expression)
					: undefined,
			].filter((value): value is string => value !== undefined);
			return {
				indexUid: query.indexUid,
				q: query.query,
				filter: filters,
				sort: meilisearchSort(query.sort, Boolean(query.query.trim())),
				offset: query.offset,
				limit: query.limit,
				attributesToRetrieve: ["id", "revision", "category", "unitType"],
			};
		}),
	);
	let response: Response;
	const startedAt = performance.now();
	try {
		response = await fetch(`${meilisearchUrl}/multi-search`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${queryKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ queries: requests }),
			signal: AbortSignal.timeout(5_000),
		});
	} catch (cause) {
		metrics.dependencyFinished(
			"meilisearch",
			"multi_search",
			performance.now() - startedAt,
			true,
		);
		throw new SearchUnavailable(cause);
	}
	metrics.dependencyFinished(
		"meilisearch",
		"multi_search",
		performance.now() - startedAt,
		!response.ok,
	);
	if (!response.ok)
		throw new SearchUnavailable(new Error(`Meilisearch returned HTTP ${response.status}`));
	const body: unknown = await response.json();
	if (!isRecord(body) || !Array.isArray(body.results) || body.results.length !== queries.length)
		throw new SearchUnavailable(new TypeError("Invalid Meilisearch multi-search response"));
	return body.results.map(parseCandidateResult);
}

interface PendingCandidateSearch {
	readonly queries: readonly CandidateQuery[];
	readonly resolve: (results: CandidateResult[]) => void;
	readonly reject: (cause: unknown) => void;
}

let pendingCandidateSearches: PendingCandidateSearch[] = [];
let candidateFlushScheduled = false;

async function flushCandidateSearches(): Promise<void> {
	const pending = pendingCandidateSearches;
	pendingCandidateSearches = [];
	candidateFlushScheduled = false;
	const uniqueQueries: CandidateQuery[] = [];
	const queryIndexes = new Map<string, number>();
	const pendingIndexes = pending.map((request) =>
		request.queries.map((query) => {
			const key = JSON.stringify(query);
			const knownIndex = queryIndexes.get(key);
			if (knownIndex !== undefined) return knownIndex;
			const index = uniqueQueries.length;
			uniqueQueries.push(query);
			queryIndexes.set(key, index);
			return index;
		}),
	);
	try {
		const results = await executeCandidateSearch(uniqueQueries);
		for (let pendingIndex = 0; pendingIndex < pending.length; pendingIndex += 1) {
			const request = pending[pendingIndex];
			const indexes = pendingIndexes[pendingIndex];
			if (!request || !indexes) continue;
			request.resolve(
				indexes.map((resultIndex) => {
					const result = results[resultIndex];
					if (!result)
						throw new SearchUnavailable(
							new TypeError("Meilisearch omitted a batched candidate result"),
						);
					return result;
				}),
			);
		}
	} catch (cause) {
		for (const request of pending) request.reject(cause);
	}
}

/**
 * Coalesce concurrent category/refill requests into one non-federated
 * `/multi-search` call. Identical facet and result scans share one subquery.
 */
export function searchCandidates(queries: readonly CandidateQuery[]): Promise<CandidateResult[]> {
	return new Promise((resolve, reject) => {
		pendingCandidateSearches.push({ queries, resolve, reject });
		if (candidateFlushScheduled) return;
		candidateFlushScheduled = true;
		queueMicrotask(() => void flushCandidateSearches());
	});
}
