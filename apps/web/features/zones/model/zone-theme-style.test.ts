import type { ZoneThemeDocument } from "@rezics/block";
import { describe, expect, it } from "vitest";

import { zoneAccentForeground, zoneThemeStyle } from "./zone-theme-style";

function theme(overrides: Partial<ZoneThemeDocument> = {}): ZoneThemeDocument {
	return {
		_type: "zone-theme",
		_key: "100000000001",
		colorScheme: "system",
		accent: "#2563eb",
		density: "comfortable",
		...overrides,
	};
}

describe("Zone theme token projection", () => {
	it("chooses the higher-contrast black or white accent foreground", () => {
		expect(zoneAccentForeground("#000000")).toBe("#ffffff");
		expect(zoneAccentForeground("#ffffff")).toBe("#000000");
		expect(zoneAccentForeground("#777777")).toBe("#000000");
	});

	it("projects defaults into the stable semantic CSS-variable contract", () => {
		const style = zoneThemeStyle(theme());

		expect(style).toMatchObject({
			"--rezics-zone-accent": "#2563eb",
			"--rezics-zone-density": "1",
			"--rezics-zone-card-radius": "0.625rem",
			"--rezics-zone-heading-font-scale": "1",
			"--rezics-zone-surface-tint": "var(--background)",
			"--primary": "#2563eb",
			"--radius": "0.625rem",
		});
	});

	it("applies explicit density, shape, typography, tint, and forced palette choices", () => {
		const style = zoneThemeStyle(
			theme({
				colorScheme: "dark",
				accent: "#f97316",
				density: "compact",
				cardRadius: "lg",
				headingFontScale: "lg",
				surfaceTint: "accent",
			}),
		);

		expect(style["--rezics-zone-density"]).toBe("0.8");
		expect(style["--rezics-zone-card-radius"]).toBe("1rem");
		expect(style["--rezics-zone-heading-font-scale"]).toBe("1.125");
		expect(style["--rezics-zone-surface-tint"]).toContain("--rezics-zone-accent");
		expect(style["--background"]).toBeDefined();
	});
});
