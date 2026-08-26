import {
	BlockKey,
	BlockDocument,
	type BlockDocument as BlockDocumentValue,
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
	createPollContentBlock,
	createPortableTextDocument,
	describeDocumentIssues,
	isDocument,
	isPortableTextDocument,
	normalizeWikiPostPortableTextDocument,
	updatePortableTextDocument,
} from "@rezics/block";
import {
	assertSearchExpression,
	combineSearchExpressions,
	createSearchCursor,
	parseSearchCursor,
	SearchCursorVersion,
} from "../../search/query";
import { describe, expect, test } from "vitest";

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
		expect([...collectBlockReferences({ _key: "000000000056", blocks: [body] }).unitIds]).toEqual([
			postId,
		]);
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

	test("isolates persisted Wiki blocks that violate their render host policy", () => {
		const normalized = normalizeWikiPostPortableTextDocument({
			_type: "portable-text",
			_key: "000000000050",
			content: [
				{
					_type: "menu",
					_key: "000000000057",
					navigationId: "019b0000-0000-7000-8000-000000000001",
					orientation: "horizontal",
					appearance: "links",
				},
			],
		});

		expect(normalized).toEqual({
			state: "repaired",
			document: { _type: "portable-text", _key: "000000000050", content: [] },
		});
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

	test("describes TypeBox path and message without returning the document", () => {
		const issues = describeDocumentIssues(UnitReferencedBlockDocument, {
			_type: "portable-text",
			_key: "000000000040",
			content: [],
		});
		expect(issues.some((issue) => issue.path === "/_type")).toBe(true);
		expect(issues.map((issue) => issue.message).join(" ")).toMatch(/block-document/i);
		expect(JSON.stringify(issues)).not.toContain("portable-text paragraphs");
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
		).not.toThrow();
		expect(() =>
			assertBlockDocument(
				{
					...document,
					blocks: [document.blocks[0], { ...document.blocks[0] }],
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
					feature: { kind: "global" },
					presentation: { pagination: "load-more", showResultCount: true },
				},
			],
		} satisfies BlockDocumentValue;

		expect(() => assertBlockDocument(document)).not.toThrow();
		expect(document.blocks[0]!.feature).toEqual({ kind: "global" });
	});

	test("validates inline Filter semantics and collects its Unit references", () => {
		const labelId = "019b0000-0000-7000-8000-000000000001";
		const tagId = "019b0000-0000-7000-8000-000000000002";
		const relationId = "019b0000-0000-7000-8000-000000000003";
		const document = {
			_type: "block-document",
			_key: "000000000014",
			blocks: [
				{
					_type: "feed",
					_key: "000000000015",
					feature: {
						kind: "inline",
						filterDocument: {
							where: { creditAttributions: { some: { id: { in: [relationId] } } } },
							controls: [
								{
									key: "tag",
									labelUnitId: labelId,
									optionPolicy: { kind: "include", values: [tagId] },
								},
							],
						},
					},
					presentation: { pagination: "load-more", showResultCount: true },
				},
			],
		} satisfies BlockDocumentValue;

		expect(() => assertBlockDocument(document)).not.toThrow();
		expect([...collectBlockReferences(document).unitIds]).toEqual([relationId, labelId, tagId]);
		expect([...collectBlockReferences(document).labelUnitIds]).toEqual([labelId]);
		expect(() =>
			assertBlockDocument({
				...document,
				blocks: [
					{
						...document.blocks[0],
						feature: {
							kind: "inline",
							filterDocument: { categories: ["units", "units"] },
						},
					},
				],
			}),
		).toThrow("categories must be unique");
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
						feature: { kind: "global" },
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
		expect([...collectNavigationReferences(navigation).labelUnitIds]).toEqual([
			"019b0000-0000-7000-8000-000000000001",
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

	test("validates additive Unit List presentation hints without persisting renderer defaults", () => {
		const collectionId = "019b0000-0000-7000-8000-000000000001";
		const headingUnitId = "019b0000-0000-7000-8000-000000000002";
		const targetUnitId = "019b0000-0000-7000-8000-000000000003";
		const legacyDocument = {
			_type: "block-document",
			_key: "000000000034",
			blocks: [
				{
					_type: "unit-list",
					_key: "000000000035",
					source: { kind: "collection", collectionId },
					layout: "carousel",
					limit: 20,
				},
			],
		} satisfies BlockDocumentValue;
		const presentedDocument = {
			_type: "block-document",
			_key: "000000000034",
			blocks: [
				{
					_type: "unit-list",
					_key: "000000000035",
					source: { kind: "collection", collectionId },
					layout: "carousel",
					limit: 20,
					presentation: {
						headingUnitId,
						viewAllTarget: { kind: "unit", unitId: targetUnitId },
					},
				},
			],
		} satisfies BlockDocumentValue;

		expect(() => assertBlockDocument(legacyDocument)).not.toThrow();
		expect(() => assertBlockDocument(presentedDocument)).not.toThrow();
		expect(presentedDocument.blocks[0]?.presentation).not.toHaveProperty("itemSize");
		expect([...collectBlockReferences(presentedDocument).unitIds]).toEqual([
			collectionId,
			headingUnitId,
			targetUnitId,
		]);
		expect([...collectBlockReferences(presentedDocument).labelUnitIds]).toEqual([headingUnitId]);
		expect(
			isDocument(BlockDocument, {
				_type: "block-document",
				_key: "000000000034",
				blocks: [
					{
						_type: "unit-list",
						_key: "000000000035",
						source: { kind: "collection", collectionId },
						layout: "carousel",
						limit: 20,
						presentation: { itemSize: "xl" },
					},
				],
			}),
		).toBe(false);
	});

	test("applies the host external-navigation policy to every Block navigation target", () => {
		const unitListDocument = {
			_type: "block-document",
			_key: "000000000036",
			blocks: [
				{
					_type: "unit-list",
					_key: "000000000037",
					source: {
						kind: "units",
						unitIds: ["019b0000-0000-7000-8000-000000000001"],
					},
					layout: "carousel",
					limit: 20,
					presentation: {
						itemSize: "md",
						viewAllTarget: { kind: "external", url: "https://example.com/all" },
					},
				},
			],
		} satisfies BlockDocumentValue;
		const mediaDocument = {
			_type: "block-document",
			_key: "000000000038",
			blocks: [
				{
					_type: "media",
					_key: "000000000039",
					assetId: "019b0000-0000-7000-8000-000000000002",
					altUnitId: "019b0000-0000-7000-8000-000000000003",
					target: { kind: "external", url: "https://example.com/media" },
					appearance: "content",
					fit: "contain",
				},
			],
		} satisfies BlockDocumentValue;
		const externalPolicy = { ...DefaultBlockHostPolicy, allowExternalNavigation: true };

		expect(() => assertBlockDocument(unitListDocument)).toThrow(
			"External navigation is not allowed",
		);
		expect(() => assertBlockDocument(mediaDocument)).toThrow("External navigation is not allowed");
		expect(() => assertBlockDocument(unitListDocument, externalPolicy)).not.toThrow();
		expect(() => assertBlockDocument(mediaDocument, externalPolicy)).not.toThrow();
		expect([...collectBlockReferences(unitListDocument).externalUrls]).toEqual([
			"https://example.com/all",
		]);
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

	test("proves display-copy references resolve to readable Label Units", async () => {
		const headingUnitId = "019b0000-0000-7000-8000-000000000001";
		const targetUnitId = "019b0000-0000-7000-8000-000000000002";
		const document = {
			_type: "block-document",
			_key: "000000000044",
			blocks: [
				{
					_type: "unit-list",
					_key: "000000000045",
					source: { kind: "units", unitIds: [targetUnitId] },
					layout: "carousel",
					limit: 20,
					presentation: { headingUnitId },
				},
			],
		} satisfies BlockDocumentValue;
		const navigation = {
			_type: "navigation-document",
			_key: "000000000046",
			items: [
				{
					_key: "000000000047",
					labelUnitId: headingUnitId,
					target: { kind: "unit", unitId: targetUnitId },
				},
			],
		} satisfies typeof NavigationDocument.static;
		const wrongKindResolver = {
			resolve: async (kind: string, identifiers: readonly string[]) =>
				new Set(kind === "unit" ? identifiers : []),
		};
		const labelResolver = {
			resolve: async (kind: string, identifiers: readonly string[]) =>
				new Set(kind === "unit" || kind === "label" ? identifiers : []),
		};

		await expect(assertResolvedBlockReferences(document, wrongKindResolver)).rejects.toThrow(
			"Unresolved label Block reference",
		);
		await expect(assertResolvedNavigationReferences(navigation, wrongKindResolver)).rejects.toThrow(
			"Unresolved label Block reference",
		);
		await expect(assertResolvedBlockReferences(document, labelResolver)).resolves.toBeUndefined();
		await expect(
			assertResolvedNavigationReferences(navigation, labelResolver),
		).resolves.toBeUndefined();
	});
});

describe("Search execution primitives", () => {
	test("validates composed searchExpression values at their runtime boundary", () => {
		expect(() =>
			assertSearchExpression({
				operator: "all",
				clauses: [{ field: "kind", operator: "equals", value: "book" }],
			}),
		).not.toThrow();
		expect(() =>
			assertSearchExpression({
				operator: "all",
				clauses: [],
			}),
		).toThrow("Invalid Search expression");
	});

	test("groups server-composed searchExpression clauses within the schema bound", () => {
		const expression = combineSearchExpressions(
			"all",
			Array.from(
				{ length: 45 },
				(_, index) =>
					({
						field: "kind",
						operator: "equals",
						value: `kind-${index}`,
					}) as const,
			),
		);

		expect(expression).toMatchObject({ operator: "all" });
		expect(() => assertSearchExpression(expression, { maxDepth: 6, maxNodes: 100 })).not.toThrow();
	});

	test("round-trips opaque cursors", () => {
		const state = {
			version: SearchCursorVersion,
			requestHash: "a".repeat(64),
			pageSize: 20,
			categories: {
				units: {
					seen: 20,
					exhausted: false,
					position: {
						primary: "12.5",
						secondary: "1720000000",
						unitId: "019f7eed-5d42-7102-8387-cc1d13b176d2",
					},
				},
			},
		};
		const cursor = createSearchCursor(state);
		expect(parseSearchCursor(cursor)).toEqual(state);
		expect(() => parseSearchCursor("s_00")).toThrow("Invalid Search cursor");
	});
});
