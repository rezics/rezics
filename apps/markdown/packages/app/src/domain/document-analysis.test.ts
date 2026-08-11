import { describe, expect, it } from "vitest";
import { analyzeMarkdownDocument } from "./document-analysis";

describe("document analysis", () => {
	it("builds source outlines from ATX and setext headings", () => {
		const analysis = analyzeMarkdownDocument("Title\n=====\n\n## Section\n\nText", "en");

		expect(analysis.outline).toEqual([
			{ level: 1, title: "Title", ordinal: 0 },
			{ level: 2, title: "Section", ordinal: 1 },
		]);
		expect(analysis.words).toBe(3);
	});

	it("does not treat fenced or indented code as outline headings", () => {
		const analysis = analyzeMarkdownDocument(
			[
				"# Visible",
				"",
				"```md",
				"# Fenced",
				"Fake setext",
				"---",
				"```",
				"",
				"    # Indented",
			].join("\n"),
			"en",
		);

		expect(analysis.outline).toEqual([{ level: 1, title: "Visible", ordinal: 0 }]);
	});

	it("derives CJK word boundaries directly from the canonical source", () => {
		const source = "# 標題\n\n本機編輯體驗";
		const analysis = analyzeMarkdownDocument(source, "zh-Hant");

		expect(analysis.outline).toEqual([{ level: 1, title: "標題", ordinal: 0 }]);
		expect(analysis.words).toBeGreaterThan(0);
		expect(analysis.characters).toBe([...source].length);
	});
});
