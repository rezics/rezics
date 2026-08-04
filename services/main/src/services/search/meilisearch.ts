import type { SearchControlPredicate, SearchScalar } from "@rezics/filter";
import { observedFetch } from "@rezics/observability";
import { sql } from "drizzle-orm";

import { env } from "../config";
import { database } from "../database";
import { InvalidSearch, SearchUnavailable } from "./errors";
import { CandidateFilterClause } from "./candidate-filter";
import {
	resolveCurrentSearchFilterDefinition,
	resolveCurrentSearchSortDefinition,
	searchFilterValues,
	type SearchFieldDefinition,
} from "./field-registry";
import type { SearchExpression } from "./query";
import { SearchCategories, type SearchCategory, type SearchSort } from "./schema";

export interface MeilisearchCandidate {
	readonly id: string;
	readonly revision: number;
	readonly category: SearchCategory;
	readonly unitType: string;
}

export interface CandidateQueryBranch {
	readonly category: SearchCategory;
	readonly expression?: SearchExpression;
}

interface CandidateQueryBase {
	readonly indexUid: string;
	readonly accessFilter?: CandidateFilterClause;
	readonly domainFilter?: CandidateFilterClause;
	readonly query: string;
	readonly offset: number;
	readonly limit: number;
	readonly sort: SearchSort;
}

export interface CandidateSearchContext {
	readonly generationId: string;
	readonly indexUid: string;
	readonly accessFilter?: CandidateFilterClause;
}

export type CandidateQuery = CandidateQueryBase &
	(
		| Readonly<{
				category: SearchCategory;
				expression?: SearchExpression;
				branches?: never;
		  }>
		| Readonly<{
				branches: readonly CandidateQueryBranch[];
				category?: never;
				expression?: never;
		  }>
	);

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

function compileOneFilter(
	category: SearchCategory,
	filter: SearchControlPredicate,
): string | undefined {
	const definition = resolveCurrentSearchFilterDefinition(category, filter);
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
		const values = searchFilterValues(filter);
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

async function coarseAccessFilter(
	profileId: string | undefined,
): Promise<CandidateFilterClause | undefined> {
	if (!profileId)
		return CandidateFilterClause.fromAccessPolicy("access.publicDiscoverable = true");
	const context = await database.execute<{ realm_ids: string[]; platform_editor: boolean }>(
		sql`select coalesce(array_agg(distinct realm_id) filter (where realm_id is not null), array[]::uuid[])::text[] as realm_ids,
				exists(select 1 from platform_capability_grant where profile_id = ${profileId}::uuid and capability = 'unit.edit' and revoked_at is null and (expires_at is null or expires_at > now())) as platform_editor
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
	return CandidateFilterClause.fromAccessPolicy(`(${terms.join(" OR ")})`);
}

/** Resolves authorization once for a complete page/facet candidate execution. */
export async function createCandidateSearchContext(
	generation: Readonly<{ id: string; indexUid: string }>,
	profileId: string | undefined,
): Promise<CandidateSearchContext> {
	const accessFilter = await coarseAccessFilter(profileId);
	return {
		generationId: generation.id,
		indexUid: generation.indexUid,
		...(accessFilter ? { accessFilter } : {}),
	};
}

function candidateQueryBranches(query: CandidateQuery): readonly CandidateQueryBranch[] {
	const branches = query.branches ?? [
		{
			category: query.category,
			...(query.expression ? { expression: query.expression } : {}),
		},
	];
	if (!branches.length) throw new InvalidSearch("Search requires at least one category");
	if (new Set(branches.map(({ category }) => category)).size !== branches.length)
		throw new InvalidSearch("Search categories must be unique");
	return branches;
}

function candidateScopeFilter(branches: readonly CandidateQueryBranch[]): string {
	const filters = branches.map((branch) => {
		const expression = branch.expression
			? compileMeilisearchExpression(branch.category, branch.expression)
			: undefined;
		const category = `category = ${JSON.stringify(branch.category)}`;
		return expression ? `(${category} AND ${expression})` : `(${category})`;
	});
	return filters.length === 1 ? filters[0]! : `(${filters.join(" OR ")})`;
}

function candidateSort(
	branches: readonly CandidateQueryBranch[],
	sort: SearchSort,
	query: string,
): readonly string[] {
	const definitions = branches.map(
		({ category }) => resolveCurrentSearchSortDefinition(category, sort, query).meilisearch,
	);
	const first = definitions[0];
	if (!first) throw new InvalidSearch("Search requires at least one category");
	if (
		definitions.some(
			(definition) =>
				definition.length !== first.length ||
				definition.some((value, index) => value !== first[index]),
		)
	)
		throw new InvalidSearch(`Search sort ${sort} has no common category ordering`);
	return first;
}

function meilisearchMatchingStrategy(sort: SearchSort): "frequency" | "last" {
	// Search relevance should relax common terms before distinctive title terms.
	// Feed and field ordering prioritize recall because text only selects candidates.
	return sort === "relevance" ? "frequency" : "last";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSearchCategory(value: string): value is SearchCategory {
	return SearchCategories.some((category) => category === value);
}

function parseCandidateResult(
	value: unknown,
	allowedCategories: ReadonlySet<SearchCategory>,
): CandidateResult {
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
			!isSearchCategory(hit.category) ||
			!allowedCategories.has(hit.category) ||
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
	const requests = queries.map((query) => {
		const branches = candidateQueryBranches(query);
		const filters = [
			candidateScopeFilter(branches),
			query.domainFilter?.value,
			query.accessFilter?.value,
		].filter((value): value is string => value !== undefined);
		return {
			indexUid: query.indexUid,
			q: query.query,
			filter: filters,
			sort: candidateSort(branches, query.sort, query.query),
			matchingStrategy: meilisearchMatchingStrategy(query.sort),
			offset: query.offset,
			limit: query.limit,
			attributesToRetrieve: ["id", "revision", "category", "unitType"],
		};
	});
	let response: Response;
	try {
		response = await observedFetch(
			{ dependency: "meilisearch", operation: "multi_search" },
			`${meilisearchUrl}/multi-search`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${queryKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ queries: requests }),
				signal: AbortSignal.timeout(env.SEARCH_CANDIDATE_TIME_BUDGET_MS ?? 1_500),
			},
		);
	} catch (cause) {
		throw new SearchUnavailable(cause);
	}
	if (!response.ok)
		throw new SearchUnavailable(new Error(`Meilisearch returned HTTP ${response.status}`));
	const body: unknown = await response.json();
	if (!isRecord(body) || !Array.isArray(body.results) || body.results.length !== queries.length)
		throw new SearchUnavailable(new TypeError("Invalid Meilisearch multi-search response"));
	return body.results.map((result, index) => {
		const query = queries[index];
		if (!query)
			throw new SearchUnavailable(new TypeError("Meilisearch returned an extra result"));
		return parseCandidateResult(
			result,
			new Set(candidateQueryBranches(query).map(({ category }) => category)),
		);
	});
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
