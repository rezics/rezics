import type { ZoneAppearanceDocument } from "@rezics/block";
import { describe, expect, it } from "vitest";

import { zoneAccentForeground, zoneAppearanceStyle } from "./zone-appearance-style";

function appearance(overrides: Partial<ZoneAppearanceDocument> = {}): ZoneAppearanceDocument {
	return {
		_type: "zone-appearance",
		_key: "100000000001",
		colorScheme: "system",
		accent: "#2563eb",
		density: "comfortable",
		...overrides,
	};
}

describe("Zone appearance token projection", () => {
	it("chooses the higher-contrast black or white accent foreground", () => {
		expect(zoneAccentForeground("#000000")).toBe("#ffffff");
		expect(zoneAccentForeground("#ffffff")).toBe("#000000");
		expect(zoneAccentForeground("#777777")).toBe("#000000");
	});

	it("projects defaults into the stable semantic CSS-variable contract", () => {
		const style = zoneAppearanceStyle(appearance());
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
		const style = zoneAppearanceStyle(
			appearance({
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
