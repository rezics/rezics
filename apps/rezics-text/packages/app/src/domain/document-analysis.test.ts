import { describe, expect, it } from "vitest";
import { activeOutlineOrdinal, analyzeMarkdownDocument } from "./document-analysis";

describe("document analysis", () => {
	it("builds source outlines from ATX and setext headings with line anchors", () => {
		const source = "Title\n=====\n\n## Section\n\nText";
		const analysis = analyzeMarkdownDocument(source, "en");

		expect(analysis.outline).toEqual([
			{ level: 1, title: "Title", ordinal: 0, line: 1, from: 0 },
			{ level: 2, title: "Section", ordinal: 1, line: 4, from: "Title\n=====\n\n".length },
		]);
		expect(analysis.words).toBe(3);
		expect(analysis.lines).toBe(6);
		expect(analysis.headings).toBe(2);
		expect(analysis.readingMinutes).toBe(1);
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

		expect(analysis.outline).toEqual([
			{ level: 1, title: "Visible", ordinal: 0, line: 1, from: 0 },
		]);
		expect(analysis.headings).toBe(1);
	});

	it("derives CJK word boundaries directly from the canonical source", () => {
		const source = "# 標題\n\n本機編輯體驗";
		const analysis = analyzeMarkdownDocument(source, "zh-Hant");

		expect(analysis.outline).toEqual([{ level: 1, title: "標題", ordinal: 0, line: 1, from: 0 }]);
		expect(analysis.words).toBeGreaterThan(0);
		expect(analysis.characters).toBe([...source].length);
		expect(analysis.lines).toBe(3);
	});

	it("treats an empty document as one line with no reading time", () => {
		const analysis = analyzeMarkdownDocument("", "en");
		expect(analysis.lines).toBe(1);
		expect(analysis.words).toBe(0);
		expect(analysis.readingMinutes).toBe(0);
		expect(analysis.outline).toEqual([]);
	});

	it("selects the last heading at or above the cursor line", () => {
		const outline = analyzeMarkdownDocument("# One\n\n## Two\n\ntext\n\n# Three", "en").outline;
		expect(activeOutlineOrdinal(outline, 1)).toBe(0);
		expect(activeOutlineOrdinal(outline, 3)).toBe(1);
		expect(activeOutlineOrdinal(outline, 5)).toBe(1);
		expect(activeOutlineOrdinal(outline, 7)).toBe(2);
		expect(activeOutlineOrdinal([], 1)).toBeUndefined();
	});
});
