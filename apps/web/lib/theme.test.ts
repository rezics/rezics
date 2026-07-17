import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { appTheme, appThemeCss, type AppThemeColors } from "./theme";

const foregroundPairs = [
	["background", "foreground"],
	["card", "cardForeground"],
	["popover", "popoverForeground"],
	["primary", "primaryForeground"],
	["secondary", "secondaryForeground"],
	["muted", "mutedForeground"],
	["accent", "accentForeground"],
	["destructive", "destructiveForeground"],
	["info", "infoForeground"],
	["success", "successForeground"],
	["warning", "warningForeground"],
	["background", "primary"],
	["sidebarPrimary", "sidebarPrimaryForeground"],
	["sidebarAccent", "sidebarAccentForeground"],
] as const satisfies readonly (readonly [keyof AppThemeColors, keyof AppThemeColors])[];

function relativeLuminance(hex: string) {
	const channels = [1, 3, 5].map(
		(offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
	);
	const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
		channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
	);
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string) {
	const firstLuminance = relativeLuminance(first);
	const secondLuminance = relativeLuminance(second);
	return (
		(Math.max(firstLuminance, secondLuminance) + 0.05) /
		(Math.min(firstLuminance, secondLuminance) + 0.05)
	);
}

describe("app theme", () => {
	it("uses the approved warm editorial palette", () => {
		expect(appTheme.light).toMatchObject({
			background: "#F7F4EE",
			primary: "#996314",
			link: "#147D78",
		});
		expect(appTheme.dark).toMatchObject({
			background: "#07131F",
			primary: "#D8A050",
			link: "#5BB8B1",
		});
	});

	it("keeps every solid semantic color pair readable", () => {
		for (const colors of Object.values(appTheme)) {
			for (const [background, foreground] of foregroundPairs) {
				expect(
					contrastRatio(colors[background], colors[foreground]),
				).toBeGreaterThanOrEqual(4.5);
			}
		}
	});

	it("emits every semantic color as a light and dark CSS variable", () => {
		expect(appThemeCss).toContain(":root{color-scheme:light;");
		expect(appThemeCss).toContain(".dark{color-scheme:dark;");

		for (const colors of Object.values(appTheme)) {
			for (const [name, value] of Object.entries(colors)) {
				const variable = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
				expect(appThemeCss).toContain(`--${variable}:${value}`);
			}
		}
	});

	it("keeps the static offline fallback aligned with the theme", () => {
		const offlineHtml = readFileSync(
			new URL("../public/offline.html", import.meta.url),
			"utf8",
		);
		const offlineColors = [
			appTheme.light.background,
			appTheme.light.foreground,
			appTheme.light.mutedForeground,
			appTheme.light.primary,
			appTheme.light.primaryForeground,
			appTheme.dark.background,
			appTheme.dark.foreground,
			appTheme.dark.mutedForeground,
			appTheme.dark.primary,
			appTheme.dark.primaryForeground,
		];

		for (const color of offlineColors)
			expect(offlineHtml.toLowerCase()).toContain(color.toLowerCase());
	});
});
