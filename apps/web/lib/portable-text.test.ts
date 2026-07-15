import type { PortableTextBlock } from "@portabletext/editor";
import { describe, expect, it } from "vitest";

import {
	toPortableTextForEditor,
	toPortableTextForReact,
	toPortableTextFromEditor,
} from "./portable-text";

describe("Portable Text boundaries", () => {
	it("keeps proven editor blocks round-trippable", () => {
		const blocks: PortableTextBlock[] = [
			{
				_key: "block-1",
				_type: "block",
				children: [{ _key: "span-1", _type: "span", text: "Hello", marks: [] }],
				markDefs: [],
				style: "normal",
			},
		];

		const wire = toPortableTextFromEditor(blocks);
		expect(wire).toEqual(blocks);
		expect(toPortableTextForEditor(wire)).toEqual(blocks);
		expect(toPortableTextForReact(wire)).toEqual(wire);
	});

	it("sanitizes untrusted editor data and keeps malformed React data out", () => {
		const editorBlocks = toPortableTextForEditor([
			{
				_key: "block-1",
				_type: "block",
				children: [
					{ _key: "span-1", _type: "span", text: "Safe", marks: ["strong", 1] },
					{},
				],
				markDefs: "invalid",
				style: 1,
			},
		]);

		expect(editorBlocks).toEqual([
			{
				_key: "block-1",
				_type: "block",
				children: [{ _key: "span-1", _type: "span", text: "Safe", marks: ["strong"] }],
				markDefs: [],
				style: "normal",
			},
		]);
		expect(
			toPortableTextForReact([{ _key: "block-1", _type: "block", children: [{}] }]),
		).toEqual([]);
	});
});
