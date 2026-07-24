import { describe, expect, it } from "vitest";

import type { PortableText } from "./index";
import {
	measurePortableText,
	PortableTextMetricAlgorithmVersion,
	portableTextMetricText,
} from "./metrics";

const textBlock = (
	key: string,
	text: string,
	marks: readonly string[] = [],
): PortableText[number] => ({
	_key: key,
	_type: "block",
	children: [{ _key: `${key}-span`, _type: "span", text, marks: [...marks] }],
	markDefs: [],
});

describe("Portable Text content metrics", () => {
	it("keeps the persisted algorithm explicitly versioned", () => {
		expect(PortableTextMetricAlgorithmVersion).toBe(1);
	});

	it("joins adjacent marked spans without inventing a word boundary", () => {
		const content: PortableText = [
			{
				_key: "paragraph",
				_type: "block",
				children: [
					{ _key: "left", _type: "span", text: "type", marks: [] },
					{ _key: "right", _type: "span", text: "safe", marks: ["strong"] },
				],
				markDefs: [],
			},
		];

		expect(portableTextMetricText(content)).toBe("typesafe");
		expect(measurePortableText(content, "en")).toEqual({
			wordCount: 1,
			characterCount: 8,
		});
	});

	it("counts visible captions but excludes alt text, links, and unknown custom blocks", () => {
		const content: PortableText = [
			{
				_key: "linked",
				_type: "block",
				children: [{ _key: "text", _type: "span", text: "Read me", marks: ["link"] }],
				markDefs: [
					{
						_key: "link",
						_type: "link",
					},
				],
			},
			{
				_key: "image",
				_type: "image",
				assetId: "019b7adf-4d49-7000-8000-000000000001",
				alt: "alternate description",
				caption: "Visible caption",
			},
			{ _key: "embed", _type: "third-party-embed" },
		];

		expect(portableTextMetricText(content)).toBe("Read me\nVisible caption\n");
		expect(measurePortableText(content, "en")).toEqual({
			wordCount: 4,
			characterCount: 20,
		});
	});

	it("keeps locale-aware Chinese words separate from user-perceived characters", () => {
		const content: PortableText = [textBlock("zh", "你好世界。")];

		expect(measurePortableText(content, "zh")).toEqual({
			wordCount: 2,
			characterCount: 5,
		});
	});

	it("treats combining marks and emoji sequences as one character each", () => {
		const content: PortableText = [textBlock("unicode", "e\u0301 👨‍👩‍👧‍👦")];

		expect(measurePortableText(content, "en")).toEqual({
			wordCount: 1,
			characterCount: 2,
		});
	});

	it("does not count whitespace-only blocks", () => {
		const content: PortableText = [textBlock("empty", " \n\t")];

		expect(measurePortableText(content, "en")).toEqual({
			wordCount: 0,
			characterCount: 0,
		});
	});
});
