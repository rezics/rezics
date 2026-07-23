import type { ResolvedSearchControl, SearchControlExpression } from "@rezics/search";
import { describe, expect, it } from "vitest";

import {
	compileDraftSearch,
	draftFromExpression,
	sharedSelectionsFromDraft,
	type DraftSearchGroup,
} from "./search-filter-builder-model";

const controls = [
	{
		key: "tag",
		field: "tag",
		component: "multi-select",
		modes: ["basic", "advanced"],
		operators: ["equals", "not-equals", "any-of", "all-of", "none-of"],
		disclosure: "visible",
		optionSource: { kind: "facet" },
	},
	{
		key: "created-at",
		field: "created-at",
		component: "date-range",
		modes: ["advanced"],
		operators: ["range", "exists"],
		disclosure: "hidden",
	},
] as const satisfies readonly ResolvedSearchControl[];

describe("advanced Search filter builder model", () => {
	it("round-trips nested Boolean groups into the control-aware Search AST", () => {
		const expression: SearchControlExpression = {
			operator: "all",
			clauses: [
				{
					controlKey: "tag",
					filter: {
						field: "tag",
						operator: "none-of",
						values: ["019b0000-0000-7000-8000-000000000001"],
					},
				},
				{
					controlKey: "created-at",
					filter: {
						field: "created-at",
						operator: "range",
						lower: "2026-01-01",
						upper: "2026-12-31",
					},
				},
			],
		};
		const compiled = compileDraftSearch(draftFromExpression(expression), controls);

		expect(compiled).toEqual({ ok: true, expression });
	});

	it("keeps incomplete conditions outside the executable state", () => {
		const root: DraftSearchGroup = {
			id: "root",
			kind: "group",
			operator: "all",
			clauses: [
				{
					id: "condition",
					kind: "condition",
					controlKey: "tag",
					operator: "any-of",
					values: [],
				},
			],
		};

		const compiled = compileDraftSearch(root, controls);

		expect(compiled.ok).toBe(false);
		if (!compiled.ok) expect(compiled.invalidIds).toContain("condition");
	});

	it("separates untrusted display hints from executable filter values", () => {
		const root: DraftSearchGroup = {
			id: "root",
			kind: "group",
			operator: "all",
			clauses: [
				{
					id: "condition",
					kind: "condition",
					controlKey: "tag",
					operator: "any-of",
					values: [
						{
							value: "019b0000-0000-7000-8000-000000000001",
							label: "設計系統",
							kind: "概念",
						},
					],
				},
			],
		};

		expect(sharedSelectionsFromDraft(root, controls)).toEqual([
			{
				field: "tag",
				value: "019b0000-0000-7000-8000-000000000001",
				title: "設計系統",
				kind: "概念",
			},
		]);
		expect(compileDraftSearch(root, controls)).toMatchObject({
			ok: true,
			expression: {
				filter: {
					values: ["019b0000-0000-7000-8000-000000000001"],
				},
			},
		});
	});
});
