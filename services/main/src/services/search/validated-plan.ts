import {
	assertUnitPredicate,
	type SearchControlPredicate,
	type UnitPredicate,
} from "@rezics/filter";

import { env } from "../config";
import { WorkPolicy } from "../performance/policy";
import { InvalidSearch } from "./errors";
import {
	assertSearchExpression,
	specializeSearchExpressionForCategory,
	type CompiledSearchRequest,
	type SearchExpression,
} from "./query";
import { resolveCurrentSearchFilterDefinition } from "./field-registry";

export interface SearchPlanComplexity {
	readonly filterNodes: number;
	readonly filterDepth: number;
	readonly filterValues: number;
	readonly expressionNodes: number;
	readonly expressionDepth: number;
	readonly positiveBranches: number;
	readonly negativeBranches: number;
	readonly disjunctiveBranches: number;
	readonly pushdownPredicates: number;
	readonly residualPredicates: number;
	readonly categories: number;
	readonly facets: number;
	readonly contexts: number;
	readonly injections: number;
	readonly pageSize: number;
	readonly candidateBatchSize: number;
	readonly candidateScanLimit: number;
	readonly candidateRounds: number;
	readonly candidateDeadlineMs: number;
	readonly viewerRelative: boolean;
	readonly countSemantics: "exact-when-exhausted-otherwise-lower-bound";
}

interface TreeSummary {
	nodes: number;
	depth: number;
	values: number;
}

function summarizeFilter(value: unknown, depth = 0): TreeSummary {
	if (value === null || typeof value !== "object")
		return { nodes: 0, depth, values: value === undefined ? 0 : 1 };
	const children = Array.isArray(value) ? value : Object.values(value);
	const summaries = children.map((child) => summarizeFilter(child, depth + 1));
	return {
		nodes: 1 + summaries.reduce((total, summary) => total + summary.nodes, 0),
		depth: summaries.reduce((maximum, summary) => Math.max(maximum, summary.depth), depth),
		values: summaries.reduce((total, summary) => total + summary.values, 0),
	};
}

interface ExpressionSummary {
	nodes: number;
	depth: number;
	positive: number;
	negative: number;
	disjunctive: number;
	predicates: SearchControlPredicate[];
}

function summarizeExpression(
	expression: SearchExpression | undefined,
	depth = 0,
	negative = false,
	disjunctive = false,
): ExpressionSummary {
	if (!expression)
		return {
			nodes: 0,
			depth: 0,
			positive: 0,
			negative: 0,
			disjunctive: 0,
			predicates: [],
		};
	if ("field" in expression)
		return {
			nodes: 1,
			depth,
			positive: negative ? 0 : 1,
			negative: negative ? 1 : 0,
			disjunctive: disjunctive ? 1 : 0,
			predicates: [expression],
		};
	const children =
		expression.operator === "not"
			? [summarizeExpression(expression.clause, depth + 1, !negative, disjunctive)]
			: expression.clauses.map((clause) =>
					summarizeExpression(
						clause,
						depth + 1,
						negative,
						disjunctive || expression.operator === "any",
					),
				);
	return {
		nodes: 1 + children.reduce((total, child) => total + child.nodes, 0),
		depth: children.reduce((maximum, child) => Math.max(maximum, child.depth), depth),
		positive: children.reduce((total, child) => total + child.positive, 0),
		negative: children.reduce((total, child) => total + child.negative, 0),
		disjunctive: children.reduce((total, child) => total + child.disjunctive, 0),
		predicates: children.flatMap((child) => child.predicates),
	};
}

function viewerRelative(filter: UnitPredicate | undefined): boolean {
	if (!filter) return false;
	const serialized = JSON.stringify(filter);
	return (
		serialized.includes('"profile"') ||
		serialized.includes('"private"') ||
		serialized.includes('"viewer"')
	);
}

/**
 * Proof object required by the search executor.
 *
 * Its constructor is private so a caller cannot manufacture proof around an
 * unvalidated compiled request. External values have already passed TypeBox
 * parsing before this final server-owned budget check runs.
 */
export class ValidatedSearchPlan<Request extends CompiledSearchRequest> {
	private constructor(
		readonly request: Request,
		readonly complexity: SearchPlanComplexity,
	) {}

	static create<Request extends CompiledSearchRequest>(
		request: Request,
		input: { readonly contexts: number; readonly injections: number },
	): ValidatedSearchPlan<Request> {
		try {
			if (request.domainFilter)
				assertUnitPredicate(request.domainFilter, {
					maxDepth: WorkPolicy.filter.maxDepth,
					maxNodes: WorkPolicy.filter.maxNodes,
				});
			if (request.searchExpression)
				assertSearchExpression(request.searchExpression, {
					maxDepth: WorkPolicy.search.maxCompiledExpressionDepth,
					maxNodes: WorkPolicy.search.maxExpressionNodes,
				});
		} catch (cause) {
			throw new InvalidSearch(
				cause instanceof Error ? cause.message : "Search exceeds budget",
			);
		}
		if (
			request.categories.length < 1 ||
			request.categories.length > WorkPolicy.search.maxCategories ||
			new Set(request.categories).size !== request.categories.length
		)
			throw new InvalidSearch("Search category budget exceeded");
		if (
			request.facets.length > WorkPolicy.search.maxFacets ||
			new Set(request.facets).size !== request.facets.length
		)
			throw new InvalidSearch("Search facet budget exceeded");
		if (input.contexts > WorkPolicy.search.maxContexts)
			throw new InvalidSearch("Search context budget exceeded");
		if (input.injections > WorkPolicy.search.maxInjections)
			throw new InvalidSearch("Search injection budget exceeded");
		if (request.pageSize < 1 || request.pageSize > WorkPolicy.search.maxPageSize)
			throw new InvalidSearch("Search page budget exceeded");
		if (
			request.maxResultWindow < request.pageSize ||
			request.maxResultWindow > WorkPolicy.search.maxResultWindow
		)
			throw new InvalidSearch("Search result-window budget exceeded");

		const filter = summarizeFilter(request.domainFilter);
		const expression = summarizeExpression(request.searchExpression);
		const executedPredicates = request.categories.flatMap((category) => {
			if (!request.searchExpression) return [];
			const specialized = specializeSearchExpressionForCategory(
				category,
				request.searchExpression,
			);
			return specialized.state === "expression"
				? summarizeExpression(specialized.expression).predicates.map((predicate) => ({
						category,
						predicate,
					}))
				: [];
		});
		const pushdownPredicates = executedPredicates.filter(({ category, predicate }) => {
			try {
				return (
					resolveCurrentSearchFilterDefinition(category, predicate).meilisearch.length > 0
				);
			} catch {
				return false;
			}
		}).length;
		return new ValidatedSearchPlan(request, {
			filterNodes: filter.nodes,
			filterDepth: filter.depth,
			filterValues: filter.values,
			expressionNodes: expression.nodes,
			expressionDepth: expression.depth,
			positiveBranches: expression.positive,
			negativeBranches: expression.negative,
			disjunctiveBranches: expression.disjunctive,
			pushdownPredicates,
			residualPredicates: executedPredicates.length - pushdownPredicates,
			categories: request.categories.length,
			facets: request.facets.length,
			contexts: input.contexts,
			injections: input.injections,
			pageSize: request.pageSize,
			candidateBatchSize: env.SEARCH_CANDIDATE_BATCH_SIZE,
			candidateScanLimit: env.SEARCH_CANDIDATE_SCAN_LIMIT,
			candidateRounds: env.SEARCH_CANDIDATE_MAX_ROUNDS,
			candidateDeadlineMs: env.SEARCH_CANDIDATE_TIME_BUDGET_MS,
			viewerRelative: viewerRelative(request.domainFilter),
			countSemantics: "exact-when-exhausted-otherwise-lower-bound",
		});
	}
}
