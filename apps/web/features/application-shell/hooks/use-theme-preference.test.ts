import { describe, expect, it } from "vitest";

import { parseThemePreference, resolveThemePreference } from "./use-theme-preference";

describe("theme preference", () => {
	it("treats an absent or invalid override as the system preference", () => {
		expect(parseThemePreference(null)).toBe("system");
		expect(parseThemePreference("system")).toBe("system");
		expect(parseThemePreference("contrast")).toBe("system");
	});

	it("accepts the stored explicit themes", () => {
		expect(parseThemePreference("light")).toBe("light");
		expect(parseThemePreference("dark")).toBe("dark");
	});

	it("resolves only the system preference from the device", () => {
		expect(resolveThemePreference("system", false)).toBe("light");
		expect(resolveThemePreference("system", true)).toBe("dark");
		expect(resolveThemePreference("light", true)).toBe("light");
		expect(resolveThemePreference("dark", false)).toBe("dark");
	});
});
