import { describe, expect, test } from "vitest";

import { extractProductDocumentMetadata } from "./productMetadataPlugin";

describe("product document metadata build boundary", () => {
	test("extracts only the authored metadata object", () => {
		const metadata = extractProductDocumentMetadata(
			`export const metadata = {
	name: "書籍",
	summary: "摘要",
	introduction: "導言",
};

## 正文`,
			"book.mdx",
		);

		expect(metadata).toEqual({
			name: "書籍",
			summary: "摘要",
			introduction: "導言",
		});
	});

	test("rejects executable metadata values", () => {
		expect(() =>
			extractProductDocumentMetadata(
				`export const metadata = {
	name: "書籍",
	summary: getSummary(),
	introduction: "導言",
};`,
				"book.mdx",
			),
		).toThrow('Product metadata "summary" must be a string literal.');
	});
});
