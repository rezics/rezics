import { describe, expect, it } from "vitest";

import {
	compileSearchFeatureInput,
	createDefaultSearchDocument,
	resolveSearchDocument,
} from "./templates";

const TagId = "019b0000-0000-7000-8000-000000000001";
const RealmId = "019b0000-0000-7000-8000-000000000002";
const SecondTagId = "019b0000-0000-7000-8000-000000000003";

describe("Search Feature v1", () => {
	it.each(["global", "book", "media", "software"] as const)(
		"resolves the %s server template",
		(template) => {
			const resolved = resolveSearchDocument(createDefaultSearchDocument(template));
			expect(resolved.document.template.id).toBe(template);
			expect(resolved.controls.length).toBeGreaterThan(0);
		},
	);

	it("lets a Zone selectively disable fields without widening its template", () => {
		const original = createDefaultSearchDocument("book");
		const document = {
			...original,
			controls: original.controls.map((control) =>
				control.field === "book-page-count" ? { ...control, enabled: false } : control,
			),
			sections: original.sections.map((section) => ({
				...section,
				controls: section.controls.filter((key) => key !== "book-page-count"),
			})),
		};

		expect(
			resolveSearchDocument(document).controls.some(
				(control) => control.field === "book-page-count",
			),
		).toBe(false);
	});

	it("composes hidden Realm context, tag injection, and Book word-count state", () => {
		const compiled = compileSearchFeatureInput({
			document: createDefaultSearchDocument("book"),
			contexts: [{ kind: "realm", realmId: RealmId }],
			injections: [
				{
					source: "tag",
					removable: true,
					value: {
						controlKey: "tag",
						filter: { field: "tag", operator: "equals", value: TagId },
					},
				},
			],
			state: {
				mode: "basic",
				values: [
					{
						controlKey: "book-word-count",
						filter: {
							field: "book-word-count",
							operator: "range",
							lower: 50_000,
							upper: 150_000,
						},
					},
				],
			},
		});

		expect(compiled.request.constraints).toContainEqual({
			field: "realm",
			operator: "equals",
			value: RealmId,
		});
		expect(compiled.request.expression).toMatchObject({ operator: "all" });
	});

	it("keeps cursor pagination out of stable input identity", () => {
		const input = {
			document: createDefaultSearchDocument("global"),
			contexts: [],
			injections: [],
			state: { mode: "basic" as const, values: [] },
		};
		const first = compileSearchFeatureInput(input);
		const next = compileSearchFeatureInput({
			...input,
			state: { ...input.state, cursor: "s2_abc" },
		});
		expect(next.inputIdentity).toBe(first.inputIdentity);
	});

	it("composes repeated injections instead of allowing state to replace them", () => {
		const compiled = compileSearchFeatureInput({
			document: createDefaultSearchDocument("global"),
			contexts: [],
			injections: [TagId, SecondTagId].map((value) => ({
				source: "tag" as const,
				removable: true,
				value: {
					controlKey: "tag",
					filter: { field: "tag" as const, operator: "equals" as const, value },
				},
			})),
			state: {
				mode: "basic",
				values: [
					{
						controlKey: "tag",
						filter: { field: "tag", operator: "equals", value: RealmId },
					},
				],
			},
		});

		expect(compiled.request.expression).toMatchObject({
			operator: "all",
			clauses: [
				{ field: "tag", value: TagId },
				{ field: "tag", value: SecondTagId },
				{ field: "tag", value: RealmId },
			],
		});
	});

	it("rejects a non-integer value for an integer control", () => {
		expect(() =>
			compileSearchFeatureInput({
				document: createDefaultSearchDocument("book"),
				contexts: [],
				injections: [],
				state: {
					mode: "basic",
					values: [
						{
							controlKey: "book-word-count",
							filter: {
								field: "book-word-count",
								operator: "range",
								lower: 12.5,
							},
						},
					],
				},
			}),
		).toThrow("invalid integer value");
	});

	it("does not let a Zone document widen template operators, sorts, or result limits", () => {
		const original = createDefaultSearchDocument("global");
		expect(() =>
			resolveSearchDocument({
				...original,
				constraints: [{ field: "tag", operator: "range", lower: TagId }],
			}),
		).toThrow("unsupported operator");
		expect(() =>
			resolveSearchDocument({
				...original,
				sort: {
					...original.sort,
					options: [...original.sort.options, "publishedAt:desc"],
				},
			}),
		).toThrow("sort is outside its template");
		expect(() =>
			resolveSearchDocument({
				...original,
				results: { ...original.results, maxResultWindow: 10_001 },
			}),
		).toThrow("result window exceeds its template");
	});

	it("carries the template result-window bound into the compiled request", () => {
		const compiled = compileSearchFeatureInput({
			document: createDefaultSearchDocument("global"),
			contexts: [],
			injections: [],
			state: { mode: "basic", values: [] },
		});
		expect(compiled.request.maxResultWindow).toBe(10_000);
	});
});
