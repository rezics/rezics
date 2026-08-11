import { describe, expect, it } from "vitest";
import { markdownThemeColor, resolveMarkdownColorScheme } from "./theme";

describe("Markdown host theme", () => {
	it("resolves explicit and system color-scheme preferences", () => {
		expect(resolveMarkdownColorScheme("light", true)).toBe("light");
		expect(resolveMarkdownColorScheme("dark", false)).toBe("dark");
		expect(resolveMarkdownColorScheme("system", false)).toBe("light");
		expect(resolveMarkdownColorScheme("system", true)).toBe("dark");
	});

	it("uses an opaque application background in both schemes", () => {
		expect(markdownThemeColor("light")).toMatch(/^#[\dA-F]{6}$/u);
		expect(markdownThemeColor("dark")).toMatch(/^#[\dA-F]{6}$/u);
		expect(markdownThemeColor("light")).not.toBe(markdownThemeColor("dark"));
	});
});
