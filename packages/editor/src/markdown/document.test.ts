import { describe, expect, it } from "vitest";
import { convertRezicsMarkdownDocument, createRezicsMarkdownDocument } from "./document";

describe("REZICS Markdown mode authority", () => {
	it("converts only at explicit source and rich boundaries", () => {
		const source = createRezicsMarkdownDocument("## A title\n\nA paragraph.");
		const rich = convertRezicsMarkdownDocument(source, "rich");
		expect(rich.ok).toBe(true);
		if (!rich.ok) return;
		expect(rich.value.mode).toBe("rich");

		const sourceAgain = convertRezicsMarkdownDocument(rich.value, "source");
		expect(sourceAgain.ok).toBe(true);
		if (!sourceAgain.ok || sourceAgain.value.mode !== "source") return;
		expect(sourceAgain.value.source).toContain("## A title");
	});

	it("keeps the authoritative source document on a blocked transition", () => {
		const source = createRezicsMarkdownDocument("Text with <mark>inline HTML</mark>.");
		const transition = convertRezicsMarkdownDocument(source, "rich");

		expect(transition.ok).toBe(false);
		expect(source).toEqual({
			mode: "source",
			source: "Text with <mark>inline HTML</mark>.",
		});
	});
});
