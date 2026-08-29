import { describe, expect, it } from "vitest";
import { rezicsTextThemeColor, resolveRezicsTextColorScheme } from "./theme";

describe("Markdown host theme", () => {
	it("resolves explicit and system color-scheme preferences", () => {
		expect(resolveRezicsTextColorScheme("light", true)).toBe("light");
		expect(resolveRezicsTextColorScheme("dark", false)).toBe("dark");
		expect(resolveRezicsTextColorScheme("system", false)).toBe("light");
		expect(resolveRezicsTextColorScheme("system", true)).toBe("dark");
	});

	it("uses an opaque application background in both schemes", () => {
		expect(rezicsTextThemeColor("light")).toMatch(/^#[\dA-F]{6}$/u);
		expect(rezicsTextThemeColor("dark")).toMatch(/^#[\dA-F]{6}$/u);
		expect(rezicsTextThemeColor("light")).not.toBe(rezicsTextThemeColor("dark"));
	});
});
