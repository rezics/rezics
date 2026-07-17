import {
	normalizePortableText,
	normalizePortableTextUrl,
	type PortableTextValue,
} from "@rezics/portable-text";
import { describe, expect, it } from "vitest";

describe("Portable Text boundaries", () => {
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
		expect(normalizePortableText(value)).toEqual(normalizePortableText(value));
		expect(normalizePortableText(value)[0]?._key).toBe("block-0");
		expect(normalizePortableText(value)[0]?.children[0]?._key).toBe("span-0-0");
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
