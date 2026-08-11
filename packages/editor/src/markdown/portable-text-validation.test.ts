import { describe, expect, it } from "vitest";
import { decodeRezicsPortableText } from "./portable-text-validation";

describe("REZICS Portable Text proof", () => {
	it("accepts a valid empty document", () => {
		expect(decodeRezicsPortableText([])).toMatchObject({ ok: true, value: [] });
	});

	it("reports paths for malformed annotations and marks", () => {
		const result = decodeRezicsPortableText([
			{
				_type: "block",
				_key: "block-1",
				style: "normal",
				markDefs: [{ _type: "unit", _key: "annotation-1", id: "unit-1" }],
				children: [
					{
						_type: "span",
						_key: "span-1",
						text: "Value",
						marks: ["unknown-decorator"],
					},
				],
			},
		]);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.diagnostics.map((item) => item.code)).toContain(
			"portable-text.unknown-annotation",
		);
		const unknownMark = result.diagnostics.find(
			(item) => item.code === "portable-text.unknown-mark",
		);
		expect(unknownMark?.location).toEqual({
			kind: "portable-text",
			path: [0, "children", 0, "marks", 0],
		});
	});

	it("rejects future fields that a Markdown renderer would otherwise drop", () => {
		const result = decodeRezicsPortableText([
			{
				_type: "block",
				_key: "block-1",
				style: "normal",
				children: [{ _type: "span", _key: "span-1", text: "Value", marks: [] }],
				markDefs: [],
				futureMetadata: { preserve: true },
			},
		]);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.diagnostics[0]).toMatchObject({
			code: "portable-text.invalid-field",
			location: { kind: "portable-text", path: [0, "futureMetadata"] },
		});
	});

	it("rejects annotations that cannot survive safe Markdown serialization", () => {
		const result = decodeRezicsPortableText([
			{
				_type: "block",
				_key: "block-1",
				style: "normal",
				markDefs: [{ _type: "link", _key: "link-1", href: "javascript:alert(1)" }],
				children: [{ _type: "span", _key: "span-1", text: "Value", marks: ["link-1"] }],
			},
		]);

		expect(result).toMatchObject({
			ok: false,
			diagnostics: [
				{
					code: "portable-text.invalid-field",
					location: { kind: "portable-text", path: [0, "markDefs", 0, "href"] },
				},
			],
		});
	});

	it("rejects empty, asymmetric, and alignment-mismatched tables", () => {
		const empty = decodeRezicsPortableText([{ _type: "table", _key: "table-1", rows: [] }]);
		expect(empty.ok).toBe(false);
		if (!empty.ok)
			expect(
				empty.diagnostics.some((item) => item.code === "portable-text.invalid-table"),
			).toBe(true);

		const textBlock = (key: string, text: string) => ({
			_type: "block",
			_key: key,
			style: "normal",
			markDefs: [],
			children: [{ _type: "span", _key: `${key}-span`, text, marks: [] }],
		});
		const malformed = decodeRezicsPortableText([
			{
				_type: "table",
				_key: "table-1",
				headerRows: 1,
				alignment: [null],
				rows: [
					{
						_type: "row",
						_key: "row-1",
						cells: [
							{ _type: "cell", _key: "cell-1", value: [textBlock("a", "A")] },
							{ _type: "cell", _key: "cell-2", value: [textBlock("b", "B")] },
						],
					},
					{
						_type: "row",
						_key: "row-2",
						cells: [{ _type: "cell", _key: "cell-3", value: [textBlock("c", "C")] }],
					},
				],
			},
		]);
		expect(malformed.ok).toBe(false);
		if (!malformed.ok)
			expect(
				malformed.diagnostics.filter((item) => item.code === "portable-text.invalid-table"),
			).toHaveLength(2);
	});

	it("rejects orphan list levels and unused annotations", () => {
		const result = decodeRezicsPortableText([
			{
				_type: "block",
				_key: "block-1",
				style: "normal",
				level: 2,
				markDefs: [{ _type: "link", _key: "link-1", href: "https://example.com" }],
				children: [{ _type: "span", _key: "span-1", text: "Value", marks: [] }],
			},
		]);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.diagnostics.map((item) => item.details?.expected)).toContain(
			"list-item-only",
		);
		expect(result.diagnostics.map((item) => item.details?.expected)).toContain(
			"referenced-annotation",
		);
	});

	it("rejects crossing inline-code and decorator ranges", () => {
		const result = decodeRezicsPortableText([
			{
				_type: "block",
				_key: "block-1",
				style: "normal",
				markDefs: [],
				children: [
					{ _type: "span", _key: "span-1", text: "code ", marks: ["code"] },
					{
						_type: "span",
						_key: "span-2",
						text: "strong code",
						marks: ["code", "strong"],
					},
				],
			},
		]);

		expect(result).toMatchObject({
			ok: false,
			diagnostics: [
				{
					code: "portable-text.invalid-field",
					location: { kind: "portable-text", path: [0, "children", 1, "marks"] },
					details: { expected: "uniform-marks-across-inline-code-run" },
				},
			],
		});
	});
});
