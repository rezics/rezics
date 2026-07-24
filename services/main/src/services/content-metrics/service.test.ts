import { describe, expect, it } from "vitest";
import { createPortableTextDocument } from "@rezics/block";

import { derivePortableTextContentMetric } from "./service";

describe("localized content metrics", () => {
	it("derives a versioned metric and canonical source identity", () => {
		const document = createPortableTextDocument(
			[
				{
					_key: "paragraph",
					_type: "block",
					children: [
						{ _key: "left", _type: "span", text: "Hello ", marks: [] },
						{ _key: "right", _type: "span", text: "world", marks: ["strong"] },
					],
					markDefs: [],
					style: "normal",
				},
			],
			"0123456789ab",
		);

		const metric = derivePortableTextContentMetric(document, "en");

		expect(metric).toMatchObject({
			language: "en",
			wordCount: 2,
			characterCount: 10,
			algorithmVersion: 1,
		});
		expect(metric.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
		expect(derivePortableTextContentMetric(document, "en")).toEqual(metric);
	});

	it("changes source identity for formatting-only edits without changing counts", () => {
		const plain = createPortableTextDocument(
			[
				{
					_key: "paragraph",
					_type: "block",
					children: [{ _key: "text", _type: "span", text: "same", marks: [] }],
					markDefs: [],
					style: "normal",
				},
			],
			"0123456789ab",
		);
		const emphasized = createPortableTextDocument(
			[
				{
					_key: "paragraph",
					_type: "block",
					children: [{ _key: "text", _type: "span", text: "same", marks: ["em"] }],
					markDefs: [],
					style: "normal",
				},
			],
			"0123456789ab",
		);

		const before = derivePortableTextContentMetric(plain, "en");
		const after = derivePortableTextContentMetric(emphasized, "en");

		expect(after.wordCount).toBe(before.wordCount);
		expect(after.characterCount).toBe(before.characterCount);
		expect(after.sourceSha256).not.toBe(before.sourceSha256);
	});
});
