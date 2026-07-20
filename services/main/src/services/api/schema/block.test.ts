import {
	BlockKey,
	BlockDocument,
	type BlockDocument as BlockDocumentValue,
	CollectionDefinitionDocument,
	DefaultBlockHostPolicy,
	NavigationDocument,
	PollContentDocument,
	PortableTextDocument,
	UnitReferencedBlockDocument,
	ZoneDockBlockHostPolicy,
	assertBlockDocument,
	assertDocument,
	assertNavigationDocument,
	assertResolvedBlockReferences,
	assertResolvedNavigationReferences,
	assertUnitReferencedBlockDocument,
	collectBlockReferences,
	collectNavigationReferences,
	createBlockKey,
	createManualCollectionDefinitionDocument,
	createPollContentDocument,
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
	defaults: [{ field: "type", operator: "any-of", values: ["book"] }],
	controls: [
		{
			key: "type",
			field: "type",
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
	results: { pageSize: 20, maxPageSize: 50, maxResultWindow: 10_000, facets: ["type"] },
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
		};
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
			assertUnitReferencedBlockDocument(referencedCopy, ZoneDockBlockHostPolicy),
		).not.toThrow();
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
		const document = createPollContentDocument(
			[
				{ optionId: "019b0000-0000-7000-8000-000000000001", label: "First" },
				{ optionId: "019b0000-0000-7000-8000-000000000002", label: "Second" },
			],
			"000000000008",
		);

		expect(isDocument(PollContentDocument, document)).toBe(true);
		expect(
			isDocument(PollContentDocument, {
				...document,
				options: [{ optionId: "not-a-uuid", label: "Invalid" }, document.options[1]],
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
				ZoneDockBlockHostPolicy,
			),
		).toThrow("Duplicate Block key");
	});

	test("stores a trusted Search feature configuration instead of engine DSL", () => {
		const document = {
			_type: "block-document",
			_key: "000000000010",
			blocks: [
				{
					_type: "search",
					_key: "000000000011",
					configuration: searchConfiguration,
					presentation: { results: "list", showResultCount: true },
				},
			],
		} satisfies BlockDocumentValue;

		expect(() => assertBlockDocument(document)).not.toThrow();
		expect("queryDsl" in (document.blocks[0]!.configuration as Record<string, unknown>)).toBe(
			false,
		);
	});

	test("separates reusable navigation content from Menu presentation", () => {
		const navigation = {
			_type: "navigation-document",
			_key: "000000000020",
			items: [
				{
					_key: "000000000021",
					labelUnitId: "019b0000-0000-7000-8000-000000000001",
					target: { kind: "zone-page", slug: "search" },
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
		expect([...collectNavigationReferences(navigation).zonePageSlugs]).toEqual(["search"]);
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
							target: { kind: "zone-page", slug: "missing" },
						},
					],
				},
				resolver,
			),
		).rejects.toThrow("Unresolved zone-page Block reference");
	});
});

describe("Search configuration semantics", () => {
	test("keeps fixed constraints but lets request state replace prefilled defaults", () => {
		const compiled = compileSearchRequest(searchConfiguration, {
			mode: "basic",
			filters: [{ field: "type", operator: "any-of", values: ["software"] }],
		});

		expect(compiled.constraints).toEqual([
			{ field: "content-rating", operator: "any-of", values: ["general"] },
			{ field: "type", operator: "any-of", values: ["software"] },
		]);
	});

	test("rejects values hidden by the configured option allow-list", () => {
		expect(() =>
			compileSearchRequest(searchConfiguration, {
				mode: "basic",
				filters: [{ field: "type", operator: "any-of", values: ["post"] }],
			}),
		).toThrow("hidden option");
	});

	test("supports a bounded structured advanced expression", () => {
		const compiled = compileSearchRequest(searchConfiguration, {
			mode: "advanced",
			expression: {
				operator: "any",
				clauses: [
					{ field: "type", operator: "any-of", values: ["book"] },
					{ field: "type", operator: "any-of", values: ["software"] },
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
			"Required Search field type is missing",
		);
		expect(() =>
			compileSearchRequest(
				{
					...searchConfiguration,
					results: { ...searchConfiguration.results, facets: ["type", "type"] },
				},
				{ mode: "basic", filters: [] },
			),
		).toThrow("Search facets must be unique");
	});
});
