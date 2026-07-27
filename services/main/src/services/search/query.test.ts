import { describe, expect, it } from "vitest";

import type { SearchExpression } from "./query";
import { specializeSearchExpressionForCategory } from "./query";

const ProfileId = "019b0000-0000-7000-8000-000000000004";
const ProfileContentExpression = {
	operator: "any",
	clauses: [
		{
			operator: "all",
			clauses: [
				{ field: "category", operator: "any-of", values: ["posts", "reviews"] },
				{ field: "credit", operator: "equals", value: ProfileId },
			],
		},
		{
			operator: "all",
			clauses: [
				{ field: "category", operator: "any-of", values: ["entity", "collections"] },
				{ field: "owner", operator: "equals", value: ProfileId },
			],
		},
	],
} satisfies SearchExpression;

describe("category Search expression specialization", () => {
	it.each([
		["posts", "credit"],
		["reviews", "credit"],
		["entity", "owner"],
		["collections", "owner"],
	] as const)("retains only the %s category's %s predicate", (category, field) => {
		expect(specializeSearchExpressionForCategory(category, ProfileContentExpression)).toEqual({
			state: "expression",
			expression: { field, operator: "equals", value: ProfileId },
		});
	});

	it.each(["units", "users", "tags", "tag-structures", "realms", "polls"] as const)(
		"proves the Profile content expression cannot match %s",
		(category) => {
			expect(
				specializeSearchExpressionForCategory(category, ProfileContentExpression),
			).toEqual({ state: "match-none" });
		},
	);

	it("preserves Boolean meaning when negating category predicates", () => {
		const expression = {
			operator: "not",
			clause: { field: "category", operator: "equals", value: "posts" },
		} satisfies SearchExpression;

		expect(specializeSearchExpressionForCategory("posts", expression)).toEqual({
			state: "match-none",
		});
		expect(specializeSearchExpressionForCategory("entity", expression)).toEqual({
			state: "match-all",
		});
	});

	it("does not let one scalar category satisfy an all-of category list", () => {
		const expression = {
			field: "category",
			operator: "all-of",
			values: ["entity", "collections"],
		} satisfies SearchExpression;

		expect(specializeSearchExpressionForCategory("entity", expression)).toEqual({
			state: "match-none",
		});
	});

	it("retains predicates that do not depend on category", () => {
		const expression = {
			operator: "all",
			clauses: [
				{ field: "category", operator: "equals", value: "entity" },
				{ field: "language", operator: "equals", value: "zh-Hant" },
			],
		} satisfies SearchExpression;

		expect(specializeSearchExpressionForCategory("entity", expression)).toEqual({
			state: "expression",
			expression: { field: "language", operator: "equals", value: "zh-Hant" },
		});
	});
});
