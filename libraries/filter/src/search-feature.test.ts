import { describe, expect, it } from "vitest";

import { readSearchLanguageBoundary, type SearchControlExpression } from "./search-feature";

const language = (values: readonly string[]): SearchControlExpression => ({
	controlKey: "language",
	filter: { field: "language", operator: "any-of", values: [...values] },
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
