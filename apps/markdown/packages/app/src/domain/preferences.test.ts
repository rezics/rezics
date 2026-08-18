import { describe, expect, it } from "vitest";
import { isMarkdownThemePreference } from "./appearance";
import { isMarkdownPreferenceSection } from "./preferences";

describe("preferences", () => {
	it("accepts only the known preference sections", () => {
		expect(isMarkdownPreferenceSection("general")).toBe(true);
		expect(isMarkdownPreferenceSection("files")).toBe(true);
		expect(isMarkdownPreferenceSection("editor")).toBe(false);
	});

	it("accepts only the known theme preferences", () => {
		expect(isMarkdownThemePreference("system")).toBe(true);
		expect(isMarkdownThemePreference("light")).toBe(true);
		expect(isMarkdownThemePreference("dark")).toBe(true);
		expect(isMarkdownThemePreference("auto")).toBe(false);
	});
});
