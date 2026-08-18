import { describe, expect, it } from "vitest";
import { isMarkdownSidebarTab, toggleMarkdownEditingMode } from "./workspace-chrome";

describe("workspace chrome", () => {
	it("switches the writing surface between live preview and source", () => {
		expect(toggleMarkdownEditingMode("preview")).toBe("source");
		expect(toggleMarkdownEditingMode("source")).toBe("preview");
	});

	it("accepts only the two sidebar tabs", () => {
		expect(isMarkdownSidebarTab("files")).toBe(true);
		expect(isMarkdownSidebarTab("outline")).toBe(true);
		expect(isMarkdownSidebarTab("source")).toBe(false);
	});
});
