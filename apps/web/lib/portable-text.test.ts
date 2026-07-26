import {
	collectPortableTextUnitMentionIds,
	isPortableTextValueBlock,
	normalizePortableText,
	normalizePortableTextUrl,
	type PortableTextValue,
} from "@rezics/portable-text";
import { describe, expect, it } from "vitest";

describe("Portable Text boundaries", () => {
	it("keeps image asset identity without accepting delivery URLs", () => {
		expect(
			normalizePortableText([
				{
					_type: "image",
					_key: "cover",
					assetId: "019f73cb-926e-7e50-9a7f-da67701accb3",
					src: "https://example.invalid/image.jpg",
					alt: "Example",
				},
			]),
		).toEqual([
			{
				_type: "image",
				_key: "cover",
				assetId: "019f73cb-926e-7e50-9a7f-da67701accb3",
				alt: "Example",
			},
		]);
	});
	it("keeps supported documents, lists, and links round-trippable", () => {
		const document: PortableTextValue = [
			{
				_key: "block-1",
				_type: "block",
				children: [
					{
						_key: "span-1",
						_type: "span",
						text: "Read more",
						marks: ["strong", "link-1"],
					},
				],
				markDefs: [
					{
						_key: "link-1",
						_type: "link",
						href: "/units/book/one",
						openInNewTab: false,
					},
				],
				style: "normal",
				listItem: "bullet",
				level: 2,
			},
		];

		expect(normalizePortableText(document)).toEqual(document);
	});

	it("keeps only identity in generic Unit mentions and collects distinct identities", () => {
		const document = [
			{
				_key: "block-1",
				_type: "block",
				children: [
					{
						_key: "mention-1",
						_type: "unit-mention",
						unitId: "019f73cb-926e-7e50-9a7f-da67701accb3",
						title: "Stale title",
					},
					{
						_key: "mention-2",
						_type: "unit-mention",
						unitId: "019f73cb-926e-7e50-9a7f-da67701accb3",
					},
				],
			},
		];

		expect(normalizePortableText(document)).toEqual([
			{
				_key: "block-1",
				_type: "block",
				children: [
					{
						_key: "mention-1",
						_type: "unit-mention",
						unitId: "019f73cb-926e-7e50-9a7f-da67701accb3",
					},
					{
						_key: "mention-2",
						_type: "unit-mention",
						unitId: "019f73cb-926e-7e50-9a7f-da67701accb3",
					},
				],
				markDefs: [],
				style: "normal",
			},
		]);
		expect(collectPortableTextUnitMentionIds(document)).toEqual([
			"019f73cb-926e-7e50-9a7f-da67701accb3",
		]);
	});

	it("drops malformed and unsupported inline objects", () => {
		expect(
			normalizePortableText([
				{
					_type: "block",
					children: [
						{ _type: "unit-mention", _key: "bad", unitId: "not-a-uuid" },
						{ _type: "profile-mention", _key: "unsupported", profileId: "one" },
					],
				},
			]),
		).toEqual([
			{
				_key: "block-0",
				_type: "block",
				children: [],
				markDefs: [],
				style: "normal",
			},
		]);
	});

	it("drops unsupported blocks, marks, and unsafe annotation values", () => {
		expect(
			normalizePortableText([
				{ _key: "image", _type: "image", src: "example.jpg" },
				{
					_key: "block-1",
					_type: "block",
					children: [
						{
							_key: "span-1",
							_type: "span",
							text: "Safe",
							marks: ["strong", "underline", "unsafe-link"],
						},
						{},
					],
					markDefs: [
						{
							_key: "unsafe-link",
							_type: "link",
							href: "javascript:alert(1)",
						},
					],
					style: "h1",
					listItem: "checkmarks",
				},
			]),
		).toEqual([
			{
				_key: "block-1",
				_type: "block",
				children: [{ _key: "span-1", _type: "span", text: "Safe", marks: ["strong"] }],
				markDefs: [],
				style: "normal",
			},
		]);
	});

	it("creates stable fallback keys for valid unkeyed text", () => {
		const value = [{ _type: "block", children: [{ _type: "span", text: "Hello" }] }];
		const normalized = normalizePortableText(value);
		expect(normalized).toEqual(normalizePortableText(value));
		const block = normalized[0];
		expect(block?._key).toBe("block-0");
		expect(block && isPortableTextValueBlock(block) ? block.children[0]?._key : undefined).toBe(
			"span-0-0",
		);
	});

	it("preserves JSON-safe custom block objects for host validation", () => {
		const columnBlock = {
			_type: "columns",
			_key: "columns-one",
			columns: [
				{ _key: "left", weight: 7, blocks: [] },
				{ _key: "right", weight: 3, blocks: [] },
			],
		};

		expect(normalizePortableText([columnBlock])).toEqual([columnBlock]);
	});

	it.each([
		["https://rezics.com/read", "https://rezics.com/read"],
		["mailto:hello@rezics.com", "mailto:hello@rezics.com"],
		["/posts/one", "/posts/one"],
		["#replies", "#replies"],
		["?sort=top", "?sort=top"],
		[" javascript:alert(1)", null],
		["data:text/html,hello", null],
		["//example.com", null],
	])("normalizes link %s", (value, expected) => {
		expect(normalizePortableTextUrl(value)).toBe(expected);
	});
});
