import { describe, expect, expectTypeOf, it } from "vitest";

import type { GlobalSearchCursorToken, GroupedSearchCursorToken, SearchExpression } from "./query";
import {
	createSearchCursor,
	createGlobalSearchCursor,
	parseGlobalSearchCursor,
	parseSearchCursor,
	readSearchExpressionLanguageBoundary,
	specializeSearchExpressionForCategory,
} from "./query";

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
				{ field: "category", operator: "any-of", values: ["entities", "collections"] },
				{ field: "owner", operator: "equals", value: ProfileId },
			],
		},
	],
} satisfies SearchExpression;

describe("category Search expression specialization", () => {
	it.each([
		["posts", "credit"],
		["reviews", "credit"],
		["entities", "owner"],
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
			expect(specializeSearchExpressionForCategory(category, ProfileContentExpression)).toEqual({
				state: "match-none",
			});
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
		expect(specializeSearchExpressionForCategory("entities", expression)).toEqual({
			state: "match-all",
		});
	});

	it("does not let one scalar category satisfy an all-of category list", () => {
		const expression = {
			field: "category",
			operator: "all-of",
			values: ["entities", "collections"],
		} satisfies SearchExpression;

		expect(specializeSearchExpressionForCategory("entities", expression)).toEqual({
			state: "match-none",
		});
	});

	it("retains predicates that do not depend on category", () => {
		const expression = {
			operator: "all",
			clauses: [
				{ field: "category", operator: "equals", value: "entities" },
				{ field: "language", operator: "equals", value: "zh-Hant" },
			],
		} satisfies SearchExpression;

		expect(specializeSearchExpressionForCategory("entities", expression)).toEqual({
			state: "expression",
			expression: { field: "language", operator: "equals", value: "zh-Hant" },
		});
	});
});

describe("Search language presentation boundary", () => {
	it("unions positive conjunctions and rejects an unconstrained disjunction", () => {
		expect(
			readSearchExpressionLanguageBoundary({
				operator: "all",
				clauses: [
					{ field: "language", operator: "equals", value: "ja" },
					{ field: "language", operator: "equals", value: "ko" },
				],
			}),
		).toEqual(["ja", "ko"]);
		expect(
			readSearchExpressionLanguageBoundary({
				operator: "any",
				clauses: [
					{ field: "language", operator: "equals", value: "ja" },
					{ field: "category", operator: "equals", value: "books" },
				],
			}),
		).toBeUndefined();
	});
});

describe("global Search cursor", () => {
	it("round-trips one global keyset without accepting a grouped cursor shape", () => {
		const state = {
			version: 3,
			requestHash: "a".repeat(64),
			pageSize: 20,
			seen: 37,
			position: {
				primary: "12.5",
				secondary: "1720000000",
				unitId: "019f7eed-5d42-7102-8387-cc1d13b176d2",
			},
		} as const;
		const cursor = createGlobalSearchCursor(state);
		const groupedCursor = createSearchCursor({
			version: 2,
			requestHash: state.requestHash,
			pageSize: state.pageSize,
			categories: { units: { seen: 37, exhausted: false, position: state.position } },
		});

		expectTypeOf(cursor).toEqualTypeOf<GlobalSearchCursorToken>();
		expectTypeOf(groupedCursor).toEqualTypeOf<GroupedSearchCursorToken>();
		expectTypeOf(cursor).not.toEqualTypeOf<GroupedSearchCursorToken>();
		expect(cursor.startsWith("s2_")).toBe(true);
		expect(parseGlobalSearchCursor(cursor)).toEqual(state);
		expect(() => parseSearchCursor(cursor)).toThrow("Invalid Search cursor");
		expect(() => parseGlobalSearchCursor(groupedCursor)).toThrow("Invalid Search cursor");
	});

	it("rejects a negative global seen count before encoding", () => {
		expect(() =>
			createGlobalSearchCursor({
				version: 3,
				requestHash: "a".repeat(64),
				pageSize: 20,
				seen: -1,
				position: {
					primary: "1",
					secondary: "0",
					unitId: "019f7eed-5d42-7102-8387-cc1d13b176d2",
				},
			}),
		).toThrow("Invalid Search cursor");
	});

	it("round-trips a zero-hit continuation that still advances its keyset", () => {
		const state = {
			version: 3,
			requestHash: "c".repeat(64),
			pageSize: 20,
			seen: 0,
			position: {
				primary: "1720000000",
				secondary: "0",
				unitId: "019f7eed-5d42-7102-8387-cc1d13b176d2",
				source: "ordered",
			},
		} as const;

		expect(parseGlobalSearchCursor(createGlobalSearchCursor(state))).toEqual(state);
	});

	it("round-trips the best phase and immutable snapshot identity", () => {
		const state = {
			version: 3,
			requestHash: "b".repeat(64),
			pageSize: 20,
			seen: 20,
			position: {
				primary: "0",
				secondary: "1720000000",
				unitId: "019f7eed-5d42-7102-8387-cc1d13b176d2",
				source: "best-zero",
				snapshotId: "019fda5f-0f34-76c6-a57f-d3d03ea687fc",
			},
		} as const;
		expect(parseGlobalSearchCursor(createGlobalSearchCursor(state))).toEqual(state);
	});
});
