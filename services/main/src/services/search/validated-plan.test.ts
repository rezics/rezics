import { describe, expect, it } from "vitest";

import { WorkPolicy } from "../performance/policy";
import type { CompiledGroupedSearchRequest } from "./query";
import { ValidatedSearchPlan } from "./validated-plan";

function request(patch: Partial<CompiledGroupedSearchRequest> = {}): CompiledGroupedSearchRequest {
	return {
		pageBudget: "per-category",
		scope: { kind: "global" },
		categories: ["units"],
		query: "",
		constraints: [],
		sort: "best",
		pageSize: 20,
		maxResultWindow: WorkPolicy.search.maxResultWindow,
		facets: [],
		...patch,
	};
}

describe("validated search plan", () => {
	it("retains complexity and execution budgets in the proof", () => {
		const plan = ValidatedSearchPlan.create(
			request({
				searchExpression: {
					operator: "any",
					clauses: [
						{ field: "kind", operator: "equals", value: "book" },
						{
							operator: "not",
							clause: { field: "language", operator: "equals", value: "en" },
						},
					],
				},
			}),
			{ contexts: 2, injections: 3 },
		);

		expect(plan.complexity).toMatchObject({
			boundedCandidateVerification: true,
			candidateSources: ["sparse-btree"],
			orderingIndexes: ["search_best_score_order_idx", "unit_public_updated_at_desc_idx"],
			maxCandidatesScanned: WorkPolicy.search.maxCandidatesScanned,
			expressionNodes: 4,
			positiveBranches: 1,
			negativeBranches: 1,
			disjunctiveBranches: 2,
			contexts: 2,
			injections: 3,
			countSemantics: "exact-when-exhausted-otherwise-lower-bound",
		});
	});

	it("rejects page and context limits before execution", () => {
		expect(() =>
			ValidatedSearchPlan.create(request({ pageSize: WorkPolicy.search.maxPageSize + 1 }), {
				contexts: 0,
				injections: 0,
			}),
		).toThrow("page budget");
		expect(() =>
			ValidatedSearchPlan.create(request(), {
				contexts: WorkPolicy.search.maxContexts + 1,
				injections: 0,
			}),
		).toThrow("context budget");
	});
});
