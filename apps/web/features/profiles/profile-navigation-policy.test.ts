import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("profile route navigation", () => {
	it("keeps route changes owned by links instead of tab triggers", () => {
		const layoutSource = readFileSync(new URL("./profile-layout.tsx", import.meta.url), "utf8");

		expect(layoutSource).toContain("<nav");
		expect(layoutSource).toContain("href={tab.href}");
		expect(layoutSource).toContain('aria-current={active ? "page" : undefined}');
		expect(layoutSource).not.toMatch(/\bTabs(?:Content|List|Trigger)?\b/);
	});
});
