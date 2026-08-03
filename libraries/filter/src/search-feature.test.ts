import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	readSearchLanguageBoundary,
	SearchContinuationToken,
	type SearchControlExpression,
} from "./search-feature";

const language = (values: readonly string[]): SearchControlExpression => ({
	controlKey: "language",
	filter: { field: "language", operator: "any-of", values: [...values] },
});

describe("Search continuation token", () => {
	it("keeps the wire contract opaque across server-owned cursor formats", () => {
		expect(Check(SearchContinuationToken, "s1_grouped-token")).toBe(true);
		expect(Check(SearchContinuationToken, "s2_global-token")).toBe(true);
		expect(Check(SearchContinuationToken, "future-format")).toBe(true);
		expect(Check(SearchContinuationToken, "")).toBe(false);
		expect(Check(SearchContinuationToken, "x".repeat(4097))).toBe(false);
	});
});

describe("readSearchLanguageBoundary", () => {
	it("reads a positive language selection from an all expression", () => {
		expect(
			readSearchLanguageBoundary({
				operator: "all",
				clauses: [
					language(["ja", "ko"]),
					{
						controlKey: "category",
						filter: { field: "category", operator: "equals", value: "book" },
					},
				],
			}),
		).toEqual(["ja", "ko"]);
	});

	it("does not infer a boundary from an unconstrained any branch", () => {
		expect(
			readSearchLanguageBoundary({
				operator: "any",
				clauses: [
					language(["ja"]),
					{
						controlKey: "category",
						filter: { field: "category", operator: "equals", value: "book" },
					},
				],
			}),
		).toBeUndefined();
	});

	it("unions independent language existence requirements", () => {
		expect(
			readSearchLanguageBoundary({
				operator: "all",
				clauses: [language(["ja", "ko"]), language(["ko", "en"])],
			}),
		).toEqual(["ja", "ko", "en"]);
	});
});
