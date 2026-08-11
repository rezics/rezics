import { describe, expect, it } from "vitest";
import {
	isMarkdownFileName,
	maximumMarkdownDocumentBytes,
	normalizeMarkdownFileName,
} from "./storage";

describe("Markdown storage contract", () => {
	it("accepts only the frozen local document extensions", () => {
		expect(isMarkdownFileName("notes.md")).toBe(true);
		expect(isMarkdownFileName("NOTES.MARKDOWN")).toBe(true);
		expect(isMarkdownFileName("notes.md.exe")).toBe(false);
		expect(isMarkdownFileName("notes.txt")).toBe(false);
	});

	it("normalizes save suggestions without rewriting valid names", () => {
		expect(normalizeMarkdownFileName(" notes ")).toBe("notes.md");
		expect(normalizeMarkdownFileName("notes.markdown")).toBe("notes.markdown");
	});

	it("shares the native host's bounded 16 MiB limit", () => {
		expect(maximumMarkdownDocumentBytes).toBe(16 * 1024 * 1024);
	});
});
