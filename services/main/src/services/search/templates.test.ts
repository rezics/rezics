import { describe, expect, it } from "vitest";
import { SearchTemplateIdValues, parseSharedSearchQueryDocument } from "@rezics/filter";

import {
	compileSearchFeatureInput as compileSearchFeatureInputForPolicy,
	createDefaultSearchDocument,
	resolveSearchDocument,
} from "./templates";

const TagId = "019b0000-0000-7000-8000-000000000001";
const RealmId = "019b0000-0000-7000-8000-000000000002";
const SecondTagId = "019b0000-0000-7000-8000-000000000003";
const ProfileId = "019b0000-0000-7000-8000-000000000004";
const GroupedSearchPolicy = {
	sortProfile: "search",
	pageBudget: "per-category",
} as const;
const SharedSearchPolicy = { sortProfile: "search", pageBudget: "shared" } as const;
const SharedFeedPolicy = { sortProfile: "feed", pageBudget: "shared" } as const;

function compileSearchFeatureInput(input: unknown) {
	return compileSearchFeatureInputForPolicy(input, GroupedSearchPolicy);
}

describe("Search Feature v1", () => {
	it.each(SearchTemplateIdValues)("resolves the %s server template", (template) => {
		const resolved = resolveSearchDocument(createDefaultSearchDocument(template), true);
		expect(resolved.document.template.id).toBe(template);
		expect(resolved.document).not.toHaveProperty("modes");
		expect(resolved.document.controls.every((control) => !("modes" in control))).toBe(true);
		if (template === "progress") expect(resolved.controls).toEqual([]);
		else expect(resolved.controls.length).toBeGreaterThan(0);
	});

	it("removes the Tag-path category and control option outside development preview", () => {
		const resolved = resolveSearchDocument(createDefaultSearchDocument("global"), false);
		const categoryControl = resolved.controls.find((control) => control.field === "category");

		expect(resolved.document.categories).not.toContain("tag-structures");
		expect(categoryControl?.optionSource).toEqual(
			expect.objectContaining({
				kind: "static",
				options: expect.not.arrayContaining([{ value: "tag-structures" }]),
			}),
		);
	});

	it("removes the Tag-path category before compiling an ordinary user's request", () => {
		const document = createDefaultSearchDocument("global");
		const compiled = compileSearchFeatureInputForPolicy(
			{ document, contexts: [], injections: [], state: { pageSize: 19 } },
			SharedFeedPolicy,
			false,
		);

		expect(compiled.request.categories).not.toContain("tag-structures");
		expect(compiled.request.pageSize).toBe(
			Math.floor(
				19 / document.categories.filter((category) => category !== "tag-structures").length,
			),
		);
	});

	it("rejects a Tag-path-only Search document outside development preview", () => {
		const document = {
			...createDefaultSearchDocument("global"),
			categories: ["tag-structures"],
		} as const;

		expect(() =>
			compileSearchFeatureInputForPolicy(
				{ document, contexts: [], injections: [], state: {} },
				GroupedSearchPolicy,
				false,
			),
		).toThrow("no available categories");
	});

	it("rejects frontend editor modes at the execution boundary", () => {
		expect(() =>
			compileSearchFeatureInput({
				document: createDefaultSearchDocument("global"),
				contexts: [],
				injections: [],
				state: { mode: "basic", values: [] },
			}),
		).toThrow("Invalid Search Feature input v1");
	});

	it("reports the failing path for a legacy persisted sort contract", () => {
		const current = createDefaultSearchDocument("global");
		expect(() =>
			resolveSearchDocument(
				{
					...current,
					sort: {
						default: "relevance",
						options: current.sort.search.options.filter((sort) => sort !== "best"),
					},
				},
				true,
			),
		).toThrow(/Invalid Search document v1 at \/sort/);
	});

	it.each(["book", "media", "software"] as const)(
		"lets the %s catalog template search direct Units and related content",
		(template) => {
			const document = createDefaultSearchDocument(template);
			expect(document.categories).toEqual(["units", "posts", "reviews", "collections"]);
			const compiled = compileSearchFeatureInput({
				document,
				contexts: [],
				injections: [],
				state: {},
			});
			expect(compiled.request.constraints).toEqual([]);
		},
	);

	it("defines personal progress search with only its supported result ordering", () => {
		const document = createDefaultSearchDocument("progress");

		expect(document.categories).toEqual(["units"]);
		expect(document.controls).toEqual([]);
		expect(document.sort.search).toEqual({
			defaults: {
				emptyQuery: "progressLastSeenAt:desc",
				textQuery: "progressLastSeenAt:desc",
			},
			options: [
				"progressLastSeenAt:desc",
				"progressLastSeenAt:asc",
				"title:asc",
				"title:desc",
			],
		});
		expect(resolveSearchDocument(document, true).controls).toEqual([]);
	});

	it("keeps the personal progress template out of shared Search documents", () => {
		expect(() =>
			parseSharedSearchQueryDocument({
				version: 1,
				template: "progress",
				state: {},
				selections: [],
			}),
		).toThrow("Invalid shared Search query document");
	});

	it("uses schema-controlled Search and Feed sorting profiles", () => {
		const document = createDefaultSearchDocument("global");
		const emptyState = {};
		const textState = {
			...emptyState,
			filter: { search: { query: "design" } },
		};
		const input = { document, contexts: [], injections: [] };

		expect(document.sort.search).toEqual({
			defaults: { emptyQuery: "best", textQuery: "relevance" },
			options: [
				"best",
				"relevance",
				"createdAt:asc",
				"createdAt:desc",
				"updatedAt:asc",
				"updatedAt:desc",
			],
		});
		expect(document.sort.feed).toEqual({
			defaults: { emptyQuery: "best", textQuery: "best" },
			options: ["best", "createdAt:asc", "createdAt:desc", "updatedAt:asc", "updatedAt:desc"],
		});
		expect(
			compileSearchFeatureInputForPolicy({ ...input, state: emptyState }, GroupedSearchPolicy)
				.request.sort,
		).toBe("best");
		expect(
			compileSearchFeatureInputForPolicy({ ...input, state: textState }, GroupedSearchPolicy)
				.request.sort,
		).toBe("relevance");
		expect(
			compileSearchFeatureInputForPolicy({ ...input, state: textState }, SharedSearchPolicy)
				.request.sort,
		).toBe("relevance");
		expect(
			compileSearchFeatureInputForPolicy({ ...input, state: textState }, SharedFeedPolicy)
				.request.sort,
		).toBe("best");
		expect(() =>
			compileSearchFeatureInputForPolicy(
				{ ...input, state: { ...textState, sort: "relevance" } },
				SharedFeedPolicy,
			),
		).toThrow("Search sort relevance is unavailable");
	});

	it("distributes a shared page budget independently from the sort profile", () => {
		const globalDocument = createDefaultSearchDocument("global");
		const globalInput = {
			document: globalDocument,
			contexts: [],
			injections: [],
			state: {},
		};

		const grouped = compileSearchFeatureInputForPolicy(globalInput, GroupedSearchPolicy);
		const sharedSearch = compileSearchFeatureInputForPolicy(globalInput, SharedSearchPolicy);
		const sharedFeed = compileSearchFeatureInputForPolicy(globalInput, SharedFeedPolicy);
		const expectedSharedPageSize = Math.max(
			1,
			Math.floor(globalDocument.results.pageSize / globalDocument.categories.length),
		);

		expect(grouped.request.pageSize).toBe(globalDocument.results.pageSize);
		expect(sharedSearch.request.pageSize).toBe(expectedSharedPageSize);
		expect(sharedFeed.request.pageSize).toBe(expectedSharedPageSize);
		expect(sharedSearch.inputIdentity).not.toBe(grouped.inputIdentity);
		expect(sharedSearch.inputIdentity).not.toBe(sharedFeed.inputIdentity);

		const realmDocument = createDefaultSearchDocument("realm");
		expect(
			compileSearchFeatureInputForPolicy(
				{
					document: realmDocument,
					contexts: [],
					injections: [],
					state: {},
				},
				SharedSearchPolicy,
			).request.pageSize,
		).toBe(realmDocument.results.pageSize);
	});

	it("uses the dedicated Realms category without a redundant kind constraint", () => {
		const compiled = compileSearchFeatureInput({
			document: createDefaultSearchDocument("realm"),
			contexts: [],
			injections: [],
			state: {},
		});

		expect(compiled.request.categories).toEqual(["realms"]);
		expect(compiled.request.constraints).toEqual([]);
	});

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
			resolveSearchDocument(document, true).controls.some(
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
				expression: {
					controlKey: "book-word-count",
					filter: {
						field: "book-word-count",
						operator: "range",
						lower: 50_000,
						upper: 150_000,
					},
				},
			},
		});

		expect(compiled.request.constraints).toContainEqual({
			field: "realm",
			operator: "equals",
			value: RealmId,
		});
		expect(compiled.request.searchExpression).toMatchObject({ operator: "all" });
	});

	it("scopes Profile search to publisher chains and current Realm or Zone ownership", () => {
		const compiled = compileSearchFeatureInput({
			document: createDefaultSearchDocument("global"),
			contexts: [{ kind: "profile", profileId: ProfileId }],
			injections: [],
			state: {},
		});

		expect(compiled.request.searchExpression).toEqual({
			operator: "any",
			clauses: [
				{
					operator: "all",
					clauses: [
						{
							operator: "any",
							clauses: [
								{
									field: "category",
									operator: "any-of",
									values: ["posts", "reviews", "entity", "collections"],
								},
								{
									operator: "all",
									clauses: [
										{
											field: "category",
											operator: "equals",
											value: "units",
										},
										{
											field: "kind",
											operator: "any-of",
											values: ["book", "media", "software"],
										},
									],
								},
							],
						},
						{
							field: "publisher-profile",
							operator: "equals",
							value: ProfileId,
						},
					],
				},
				{
					operator: "all",
					clauses: [
						{
							operator: "any",
							clauses: [
								{
									field: "category",
									operator: "equals",
									value: "realms",
								},
								{
									operator: "all",
									clauses: [
										{
											field: "category",
											operator: "equals",
											value: "units",
										},
										{
											field: "kind",
											operator: "equals",
											value: "zone",
										},
									],
								},
							],
						},
						{ field: "owner", operator: "equals", value: ProfileId },
					],
				},
			],
		});
	});

	it("keeps cursor pagination out of stable input identity", () => {
		const input = {
			document: createDefaultSearchDocument("global"),
			contexts: [],
			injections: [],
			state: {},
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
				expression: {
					controlKey: "tag",
					filter: { field: "tag", operator: "equals", value: RealmId },
				},
			},
		});

		expect(compiled.request.searchExpression).toMatchObject({
			operator: "all",
			clauses: [
				{ field: "tag", value: TagId },
				{ field: "tag", value: SecondTagId },
				{ field: "tag", value: RealmId },
			],
		});
	});

	it("keeps Realm, global Tags, and Realm Tag vote as independent sibling predicates", () => {
		const document = createDefaultSearchDocument("global");
		const compiled = compileSearchFeatureInput({
			document,
			contexts: [],
			injections: [],
			state: {
				expression: {
					operator: "all",
					clauses: [
						{
							controlKey: "realm",
							filter: { field: "realm", operator: "equals", value: RealmId },
						},
						{
							controlKey: "tag",
							filter: { field: "tag", operator: "equals", value: TagId },
						},
						{
							controlKey: "realm-tag-vote",
							filter: {
								field: "realm-tag-vote",
								operator: "matches",
								realmId: RealmId,
								tagId: SecondTagId,
								score: { lower: 1 },
								voteCount: { lower: 2 },
							},
						},
					],
				},
			},
		});

		expect(compiled.request.searchExpression).toEqual({
			operator: "all",
			clauses: [
				{ field: "realm", operator: "equals", value: RealmId },
				{ field: "tag", operator: "equals", value: TagId },
				{
					field: "realm-tag-vote",
					operator: "matches",
					realmId: RealmId,
					tagId: SecondTagId,
					score: { lower: 1 },
					voteCount: { lower: 2 },
				},
			],
		});
	});

	it("normalizes Realm and Tag set operators into ordinary Boolean siblings", () => {
		const compiled = compileSearchFeatureInput({
			document: createDefaultSearchDocument("global"),
			contexts: [],
			injections: [],
			state: {
				expression: {
					operator: "all",
					clauses: [
						{
							controlKey: "realm",
							filter: {
								field: "realm",
								operator: "all-of",
								values: [RealmId],
							},
						},
						{
							controlKey: "tag",
							filter: {
								field: "tag",
								operator: "all-of",
								values: [TagId, SecondTagId],
							},
						},
					],
				},
			},
		});

		expect(compiled.request.searchExpression).toEqual({
			operator: "all",
			clauses: [
				{ field: "realm", operator: "equals", value: RealmId },
				{ field: "tag", operator: "equals", value: TagId },
				{ field: "tag", operator: "equals", value: SecondTagId },
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
					expression: {
						controlKey: "book-word-count",
						filter: {
							field: "book-word-count",
							operator: "range",
							lower: 12.5,
						},
					},
				},
			}),
		).toThrow("invalid integer value");
	});

	it("keeps a Search document domain Filter separate from searchExpression", () => {
		const original = createDefaultSearchDocument("global");
		const document = {
			...original,
			filter: {
				collection: {
					is: { items: { some: { kind: { in: ["book"] } } } },
				},
			},
		} as const;
		expect(resolveSearchDocument(document, true).document.filter).toEqual(document.filter);
		const compiled = compileSearchFeatureInput({
			document,
			contexts: [],
			injections: [],
			state: {},
		});
		expect(compiled.request.domainFilter).toEqual(document.filter);
		expect(compiled.request.searchExpression).toBeUndefined();
	});

	it("does not let a Zone document widen template sorts or result limits", () => {
		const original = createDefaultSearchDocument("global");
		expect(() =>
			resolveSearchDocument(
				{
					...original,
					sort: {
						...original.sort,
						search: {
							...original.sort.search,
							options: [...original.sort.search.options, "publishedAt:desc"],
						},
					},
				},
				true,
			),
		).toThrow("sort is outside its template");
		expect(() =>
			resolveSearchDocument(
				{
					...original,
					results: { ...original.results, maxResultWindow: 10_001 },
				},
				true,
			),
		).toThrow("result window exceeds its template");
	});

	it("carries the template result-window bound into the compiled request", () => {
		const compiled = compileSearchFeatureInput({
			document: createDefaultSearchDocument("global"),
			contexts: [],
			injections: [],
			state: {},
		});
		expect(compiled.request.maxResultWindow).toBe(10_000);
	});

	it("accepts a cursor-free shared query and rejects duplicate display hints", () => {
		const document = {
			version: 1,
			template: "global",
			state: {
				filter: { search: { query: "design" } },
				expression: {
					controlKey: "tag",
					filter: { field: "tag", operator: "any-of", values: [TagId] },
				},
			},
			selections: [{ field: "tag", value: TagId, title: "Design", kind: "concept" }],
		} as const;

		expect(parseSharedSearchQueryDocument(document)).toBe(document);
		expect(() =>
			parseSharedSearchQueryDocument({
				...document,
				selections: [...document.selections, ...document.selections],
			}),
		).toThrow("must be unique");
		expect(() =>
			parseSharedSearchQueryDocument({
				...document,
				selections: [
					{
						field: "tag",
						value: SecondTagId,
						title: "Removed tag",
						kind: "concept",
					},
				],
			}),
		).toThrow("must reference executable values");
		expect(
			compileSearchFeatureInput({
				document: createDefaultSearchDocument(document.template),
				contexts: [],
				injections: [],
				state: document.state,
			}).request.searchExpression,
		).toMatchObject({ field: "tag", operator: "equals", value: TagId });
	});
});
