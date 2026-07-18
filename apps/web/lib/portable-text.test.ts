import {
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
		expect(block?._type === "block" ? block.children[0]?._key : undefined).toBe("span-0-0");
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
