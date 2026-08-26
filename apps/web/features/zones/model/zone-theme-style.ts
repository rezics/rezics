import {
	ZoneThemeTokenDefaults,
	type ZoneStylingContractCssVariable,
	type ZoneThemeDocument,
} from "@rezics/block";
import { appTheme, type AppThemeColors } from "@rezics/ui/theme";
import type { CSSProperties } from "react";

type CustomPropertyName = `--${string}`;

export type ZoneThemeStyle = CSSProperties &
	Record<ZoneStylingContractCssVariable, string> &
	Partial<Record<CustomPropertyName, string>>;

const CardRadius = {
	sm: "0.375rem",
	md: "0.625rem",
	lg: "1rem",
} as const;

const HeadingFontScale = {
	sm: "0.9375",
	md: "1",
	lg: "1.125",
} as const;

const Density = {
	comfortable: "1",
	compact: "0.8",
} as const;

const SurfaceTint = {
	none: "var(--background)",
	subtle: "color-mix(in srgb, var(--foreground) 3%, var(--background))",
	accent: "color-mix(in srgb, var(--rezics-zone-accent) 9%, var(--background))",
} as const;

function channelToLinear(channel: number): number {
	const normalized = channel / 255;
	return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
	const red = Number.parseInt(hex.slice(1, 3), 16);
	const green = Number.parseInt(hex.slice(3, 5), 16);
	const blue = Number.parseInt(hex.slice(5, 7), 16);
	return (
		0.2126 * channelToLinear(red) + 0.7152 * channelToLinear(green) + 0.0722 * channelToLinear(blue)
	);
}

/** Picks the black or white foreground with the stronger WCAG contrast. */
export function zoneAccentForeground(accent: string): "#000000" | "#ffffff" {
	const luminance = relativeLuminance(accent);
	const contrastWithBlack = (luminance + 0.05) / 0.05;
	const contrastWithWhite = 1.05 / (luminance + 0.05);
	return contrastWithBlack >= contrastWithWhite ? "#000000" : "#ffffff";
}

function cssVariableName(name: keyof AppThemeColors): CustomPropertyName {
	return `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function forcedPalette(colorScheme: ZoneThemeDocument["colorScheme"]): Record<string, string> {
	if (colorScheme === "system") return {};
	return Object.fromEntries(
		Object.entries(appTheme[colorScheme]).map(([name, value]) => [
			cssVariableName(name as keyof AppThemeColors),
			value,
		]),
	);
}

export function zoneThemeStyle(theme: ZoneThemeDocument): ZoneThemeStyle {
	const accentForeground = zoneAccentForeground(theme.accent);
	const cardRadius = theme.cardRadius ?? ZoneThemeTokenDefaults.cardRadius;
	const headingFontScale = theme.headingFontScale ?? ZoneThemeTokenDefaults.headingFontScale;
	const surfaceTint = theme.surfaceTint ?? ZoneThemeTokenDefaults.surfaceTint;
	return {
		...forcedPalette(theme.colorScheme),
		"--rezics-zone-accent": theme.accent,
		"--rezics-zone-accent-foreground": accentForeground,
		"--rezics-zone-density": Density[theme.density],
		"--rezics-zone-card-radius": CardRadius[cardRadius],
		"--rezics-zone-heading-font-scale": HeadingFontScale[headingFontScale],
		"--rezics-zone-surface-tint": SurfaceTint[surfaceTint],
		"--primary": theme.accent,
		"--primary-foreground": accentForeground,
		"--ring": theme.accent,
		"--radius": CardRadius[cardRadius],
	};
}
