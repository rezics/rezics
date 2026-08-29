import { describe, expect, it } from "vitest";
import { isRezicsTextThemePreference } from "./appearance";
import { isMarkdownPreferenceSection } from "./preferences";

describe("preferences", () => {
	it("accepts only the known preference sections", () => {
		expect(isMarkdownPreferenceSection("general")).toBe(true);
		expect(isMarkdownPreferenceSection("files")).toBe(true);
		expect(isMarkdownPreferenceSection("editor")).toBe(false);
	});

	it("accepts only the known theme preferences", () => {
		expect(isRezicsTextThemePreference("system")).toBe(true);
		expect(isRezicsTextThemePreference("light")).toBe(true);
		expect(isRezicsTextThemePreference("dark")).toBe(true);
		expect(isRezicsTextThemePreference("auto")).toBe(false);
	});
});
