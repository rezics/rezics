import {
	BlockKey,
	BlockDocument,
	type BlockDocument as BlockDocumentValue,
	CollectionDefinitionDocument,
	DefaultBlockHostPolicy,
	DockBlockHostPolicy,
	DockDocument,
	NavigationDocument,
	PollContentBlock,
	PortableTextDocument,
	UnitReferencedBlockDocument,
	ZonePageBlockHostPolicy,
	assertDockDocument,
	assertBlockDocument,
	assertDocument,
	assertNavigationDocument,
	assertResolvedBlockReferences,
	assertResolvedNavigationReferences,
	assertUnitReferencedBlockDocument,
	assertWikiPostPortableTextDocument,
	collectBlockReferences,
	collectNavigationReferences,
	createBlockKey,
	createDockDocument,
	createManualCollectionDefinitionDocument,
	createPollContentBlock,
	createPortableTextDocument,
	createSystemCollectionDefinitionDocument,
	isDocument,
	isPortableTextDocument,
	updatePortableTextDocument,
} from "@rezics/block";
import {
	compileSearchRequest,
	createSearchCursor,
	parseSearchCursor,
	type SearchConfiguration,
} from "@rezics/search";
import { describe, expect, test } from "vitest";

const searchConfiguration = {
	scope: { kind: "global" },
	categories: ["units"],
	modes: { available: ["basic", "advanced"], default: "basic" },
	query: { enabled: true },
	constraints: [{ field: "content-rating", operator: "any-of", values: ["general"] }],
	defaults: [{ field: "kind", operator: "any-of", values: ["book"] }],
	controls: [
		{
			key: "kind",
			field: "kind",
			component: "multi-select",
			modes: ["basic", "advanced"],
			operators: ["any-of"],
			optionSource: {
				kind: "static",
				options: [{ value: "book" }, { value: "software" }],
			},
			optionPolicy: { kind: "include", values: ["book", "software"] },
		},
	],
	sort: { default: "relevance", options: ["relevance"] },
	results: { pageSize: 20, maxPageSize: 50, maxResultWindow: 10_000, facets: ["kind"] },
} satisfies SearchConfiguration;

describe("Block document contracts", () => {
	test("creates document-local twelve-character hexadecimal keys", () => {
		const keys = Array.from({ length: 32 }, () => createBlockKey());

		expect(keys).toHaveLength(32);
		expect(keys.every((key) => isDocument(BlockKey, key))).toBe(true);
		expect(new Set(keys).size).toBe(keys.length);
	});

	test("requires the Portable Text envelope instead of accepting a raw array", () => {
		const document = createPortableTextDocument([], "0123456789ab");

		expect(isPortableTextDocument(document)).toBe(true);
		expect(isPortableTextDocument([])).toBe(false);
		expect(
			isPortableTextDocument({
				_type: "portable-text",
				_key: "position-1",
				content: [],
			}),
		).toBe(false);
		expect(() => assertDocument(PortableTextDocument, [])).toThrow("Invalid Block document");
	});

	test("preserves Portable Text identity across content updates", () => {
		const original = createPortableTextDocument([], "abcdef012345");
		const nextContent: PortableTextDocument["content"] = [];
		const updated = updatePortableTextDocument(original, nextContent);

		expect(updated).not.toBe(original);
		expect(updated._key).toBe(original._key);
		expect(updated.content).toBe(nextContent);
	});

	test("validates Columns recursively when embedded as a Portable Text block object", () => {
		const postId = "019b0000-0000-7000-8000-000000000001";
		const body = createPortableTextDocument(
			[
				{
					_type: "columns",
					_key: "000000000051",
					columns: [
						{
							_key: "000000000052",
							weight: 7,
							blocks: [createPortableTextDocument([], "000000000053")],
						},
						{
							_key: "000000000054",
							weight: 3,
							blocks: [
								{
									_type: "unit-ref",
									_key: "000000000055",
									unitId: postId,
									appearance: "card",
								},
							],
						},
					],
				},
			],
			"000000000050",
		);

		expect(() => assertWikiPostPortableTextDocument(body)).not.toThrow();
		expect([
			...collectBlockReferences({ _key: "000000000056", blocks: [body] }).unitIds,
		]).toEqual([postId]);
		expect(() =>
			assertWikiPostPortableTextDocument({
				...body,
				content: [
					{
						_type: "menu",
						_key: "000000000057",
						navigationId: postId,
						orientation: "horizontal",
						appearance: "links",
					},
				],
			}),
		).toThrow("not allowed");
	});

	test("treats Post Full View as a Wiki Post reference", () => {
		const postId = "019b0000-0000-7000-8000-000000000001";
		const document = {
			_type: "block-document",
			_key: "000000000060",
			blocks: [{ _type: "post-full-view", _key: "000000000061", postId }],
		} satisfies typeof UnitReferencedBlockDocument.static;

		expect(() =>
			assertUnitReferencedBlockDocument(document, ZonePageBlockHostPolicy),
		).not.toThrow();
		expect([...collectBlockReferences(document).wikiPostIds]).toEqual([postId]);
	});

	test("requires Zone composition copy to be referenced through localized Units", () => {
		const inlineCopy = {
			_type: "block-document",
			_key: "000000000040",
			blocks: [createPortableTextDocument([], "000000000041")],
		};
		const referencedCopy = {
			_type: "block-document",
			_key: "000000000042",
			blocks: [
				{
					_type: "unit-ref",
					_key: "000000000043",
					unitId: "019b0000-0000-7000-8000-000000000001",
					appearance: "card",
				},
			],
		} satisfies typeof UnitReferencedBlockDocument.static;
		const nestedInlineCopy = {
			_type: "block-document",
			_key: "000000000044",
			blocks: [
				{
					_type: "group",
					_key: "000000000045",
					layout: "stack",
					blocks: [createPortableTextDocument([], "000000000046")],
				},
			],
		};

		expect(isDocument(BlockDocument, inlineCopy)).toBe(true);
		expect(isDocument(UnitReferencedBlockDocument, inlineCopy)).toBe(false);
		expect(isDocument(UnitReferencedBlockDocument, nestedInlineCopy)).toBe(false);
		expect(isDocument(UnitReferencedBlockDocument, referencedCopy)).toBe(true);
		expect(() =>
			assertUnitReferencedBlockDocument(referencedCopy, DockBlockHostPolicy),
		).not.toThrow();
		const dock = createDockDocument(referencedCopy.blocks, "000000000047");
		expect(isDocument(DockDocument, dock)).toBe(true);
		expect(isDocument(UnitReferencedBlockDocument, dock)).toBe(false);
		expect(() => assertDockDocument(dock)).not.toThrow();
	});

	test("keeps Collection source variants mutually exclusive", () => {
		const manual = createManualCollectionDefinitionDocument("000000000005");
		const favorites = createSystemCollectionDefinitionDocument("favorites", "000000000006");

		expect(isDocument(CollectionDefinitionDocument, manual)).toBe(true);
		expect(isDocument(CollectionDefinitionDocument, favorites)).toBe(true);
		expect(
			isDocument(CollectionDefinitionDocument, {
				_type: "collection-definition",
				_key: "000000000007",
				source: "system",
			}),
		).toBe(false);
	});

	test("validates Poll option identifiers without external format registration", () => {
		const block = createPollContentBlock(
			[
				{ optionId: "019b0000-0000-7000-8000-000000000001", label: "First" },
				{ optionId: "019b0000-0000-7000-8000-000000000002", label: "Second" },
			],
			"000000000008",
		);

		expect(isDocument(PollContentBlock, block)).toBe(true);
		expect(
			isDocument(PollContentBlock, {
				...block,
				options: [{ optionId: "not-a-uuid", label: "Invalid" }, block.options[1]],
			}),
		).toBe(false);
		expect(
			isDocument(PollContentBlock, {
				...block,
				options: [{ ...block.options[0], description: [] }, block.options[1]],
			}),
		).toBe(false);
	});

	test("validates host policy, nested identity, and Unit references", () => {
		const document = {
			_type: "block-document",
			_key: "000000000001",
			blocks: [
				{
					_type: "group",
					_key: "000000000002",
					layout: "stack",
					blocks: [
						{
							_type: "unit-ref",
							_key: "000000000003",
							unitId: "019b0000-0000-7000-8000-000000000001",
							appearance: "card",
						},
					],
				},
			],
		} satisfies BlockDocumentValue;

		expect(isDocument(BlockDocument, document)).toBe(true);
		expect(() => assertBlockDocument(document, DefaultBlockHostPolicy)).not.toThrow();
		expect([...collectBlockReferences(document).unitIds]).toEqual([
			"019b0000-0000-7000-8000-000000000001",
		]);
		expect(() =>
			assertBlockDocument(
				{
					...document,
					blocks: [{ ...document.blocks[0], _key: document._key }],
				},
				DockBlockHostPolicy,
			),
		).toThrow("Duplicate Block key");
	});

	test("stores a stable Feed Search Feature source instead of an embedded query schema", () => {
		const document = {
			_type: "block-document",
			_key: "000000000010",
			blocks: [
				{
					_type: "feed",
					_key: "000000000011",
					feature: { kind: "template", template: "global" },
					presentation: { pagination: "load-more", showResultCount: true },
				},
			],
		} satisfies BlockDocumentValue;

		expect(() => assertBlockDocument(document)).not.toThrow();
		expect(document.blocks[0]!.feature).toEqual({ kind: "template", template: "global" });
	});

	test("rejects Feed-owned filter defaults", () => {
		expect(() =>
			assertBlockDocument({
				_type: "block-document",
				_key: "000000000012",
				blocks: [
					{
						_type: "feed",
						_key: "000000000013",
						feature: { kind: "template", template: "global" },
						defaults: [],
						presentation: { pagination: "load-more", showResultCount: true },
					},
				],
			}),
		).toThrow();
	});

	test("separates reusable navigation content from Menu presentation", () => {
		const navigation = {
			_type: "navigation-document",
			_key: "000000000020",
			items: [
				{
					_key: "000000000021",
					labelUnitId: "019b0000-0000-7000-8000-000000000001",
					target: {
						kind: "unit",
						unitId: "019b0000-0000-7000-8000-000000000002",
					},
				},
			],
		} satisfies typeof NavigationDocument.static;
		const document = {
			_type: "block-document",
			_key: "000000000022",
			blocks: [
				{
					_type: "menu",
					_key: "000000000023",
					navigationId: "019b0000-0000-7000-8000-000000000002",
					orientation: "horizontal",
					appearance: "buttons",
				},
			],
		} satisfies BlockDocumentValue;

		expect(() => assertNavigationDocument(navigation)).not.toThrow();
		expect([...collectNavigationReferences(navigation).unitIds]).toEqual([
			"019b0000-0000-7000-8000-000000000001",
			"019b0000-0000-7000-8000-000000000002",
		]);
		expect(() => assertBlockDocument(document)).not.toThrow();
		expect([...collectBlockReferences(document).navigationIds]).toEqual([
			"019b0000-0000-7000-8000-000000000002",
		]);
	});

	test("requires unique explicit Unit references and localized media alternative text", () => {
		const duplicateList = {
			_type: "block-document",
			_key: "000000000030",
			blocks: [
				{
					_type: "unit-list",
					_key: "000000000031",
					source: {
						kind: "units",
						unitIds: [
							"019b0000-0000-7000-8000-000000000001",
							"019b0000-0000-7000-8000-000000000001",
						],
					},
					layout: "grid",
					limit: 20,
				},
			],
		} satisfies BlockDocumentValue;

		expect(() => assertBlockDocument(duplicateList)).toThrow("duplicate Unit references");
		expect(
			isDocument(BlockDocument, {
				_type: "block-document",
				_key: "000000000032",
				blocks: [
					{
						_type: "media",
						_key: "000000000033",
						assetId: "019b0000-0000-7000-8000-000000000003",
						appearance: "content",
						fit: "contain",
					},
				],
			}),
		).toBe(false);
	});

	test("rejects structurally valid documents whose host references do not resolve", async () => {
		const unitId = "019b0000-0000-7000-8000-000000000001";
		const document = {
			_type: "block-document",
			_key: "000000000040",
			blocks: [
				{
					_type: "unit-ref",
					_key: "000000000041",
					unitId,
					appearance: "card",
				},
			],
		} satisfies BlockDocumentValue;
		const resolver = {
			resolve: async (kind: string) => new Set(kind === "unit" ? [unitId] : []),
		};

		await expect(assertResolvedBlockReferences(document, resolver)).resolves.toBeUndefined();
		await expect(
			assertResolvedBlockReferences(document, { resolve: async () => new Set() }),
		).rejects.toThrow("Unresolved unit Block reference");
		await expect(
			assertResolvedNavigationReferences(
				{
					_type: "navigation-document",
					_key: "000000000042",
					items: [
						{
							_key: "000000000043",
							labelUnitId: unitId,
							target: {
								kind: "unit",
								unitId: "019b0000-0000-7000-8000-000000000002",
							},
						},
					],
				},
				resolver,
			),
		).rejects.toThrow("Unresolved unit Block reference");
	});
});

describe("Search configuration semantics", () => {
	test("keeps fixed constraints but lets request state replace prefilled defaults", () => {
		const compiled = compileSearchRequest(searchConfiguration, {
			mode: "basic",
			filters: [{ field: "kind", operator: "any-of", values: ["software"] }],
		});

		expect(compiled.constraints).toEqual([
			{ field: "content-rating", operator: "any-of", values: ["general"] },
			{ field: "kind", operator: "any-of", values: ["software"] },
		]);
	});

	test("rejects values hidden by the configured option allow-list", () => {
		expect(() =>
			compileSearchRequest(searchConfiguration, {
				mode: "basic",
				filters: [{ field: "kind", operator: "any-of", values: ["post"] }],
			}),
		).toThrow("hidden option");
	});

	test("supports a bounded structured advanced expression", () => {
		const compiled = compileSearchRequest(searchConfiguration, {
			mode: "advanced",
			expression: {
				operator: "any",
				clauses: [
					{ field: "kind", operator: "any-of", values: ["book"] },
					{ field: "kind", operator: "any-of", values: ["software"] },
				],
			},
		});

		expect(compiled.expression).toMatchObject({ operator: "any" });
	});

	test("round-trips opaque cursors through the trusted request compiler", () => {
		const state = {
			version: 2 as const,
			generationId: "019f7eed-5d42-7102-8387-cc1d13b176d2",
			requestHash: "a".repeat(64),
			pageSize: 20,
			categories: { units: { offset: 720, exhausted: false } },
		};
		const cursor = createSearchCursor(state);
		const compiled = compileSearchRequest(searchConfiguration, {
			mode: "basic",
			filters: [],
			cursor,
		});

		expect(compiled.cursor).toBe(cursor);
		if (!compiled.cursor) throw new Error("Compiled cursor is missing");
		expect(parseSearchCursor(compiled.cursor)).toEqual(state);
		expect(() => parseSearchCursor("s_00")).toThrow("Invalid Search cursor");
	});

	test("enforces required controls and unique configuration identities", () => {
		const required = {
			...searchConfiguration,
			defaults: [],
			controls: [{ ...searchConfiguration.controls[0]!, required: true }],
		} satisfies SearchConfiguration;

		expect(() => compileSearchRequest(required, { mode: "basic", filters: [] })).toThrow(
			"Required Search field kind is missing",
		);
		expect(() =>
			compileSearchRequest(
				{
					...searchConfiguration,
					results: { ...searchConfiguration.results, facets: ["kind", "kind"] },
				},
				{ mode: "basic", filters: [] },
			),
		).toThrow("Search facets must be unique");
	});
});
