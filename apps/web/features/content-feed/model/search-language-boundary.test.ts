import { describe, expect, it } from "vitest";

import { hasSearchLanguagePresentationBoundary } from "./search-language-boundary";

describe("Search Feed language presentation boundary", () => {
	it("recognizes expression and Unit Filter language boundaries", () => {
		expect(
			hasSearchLanguagePresentationBoundary({
				expression: {
					controlKey: "language",
					filter: { field: "language", operator: "any-of", values: ["ja", "ko"] },
				},
			}),
		).toBe(true);
		expect(
			hasSearchLanguagePresentationBoundary({
				filter: {
					where: { localizations: { some: { language: { in: ["ja"] } } } },
				},
			}),
		).toBe(true);
	});

	it("does not claim an unsafe boundary for an unconstrained disjunction", () => {
		expect(
			hasSearchLanguagePresentationBoundary({
				expression: {
					operator: "any",
					clauses: [
						{
							controlKey: "language",
							filter: { field: "language", operator: "equals", value: "ja" },
						},
						{
							controlKey: "category",
							filter: { field: "category", operator: "equals", value: "book" },
						},
					],
				},
			}),
		).toBe(false);
	});
});
