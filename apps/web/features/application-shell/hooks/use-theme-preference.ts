"use client";

import { useCallback, useEffect, useState } from "react";

export const ThemePreferenceValues = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof ThemePreferenceValues)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

const ThemePreferenceKey = "rezics-theme";

export function isThemePreference(value: string): value is ThemePreference {
	return ThemePreferenceValues.some((preference) => preference === value);
}

export function parseThemePreference(value: string | null): ThemePreference {
	return value === "light" || value === "dark" ? value : "system";
}

export function resolveThemePreference(
	preference: ThemePreference,
	prefersDark: boolean,
): ResolvedTheme {
	return preference === "system" ? (prefersDark ? "dark" : "light") : preference;
}

function readThemePreference(): ThemePreference {
	try {
		return parseThemePreference(localStorage.getItem(ThemePreferenceKey));
	} catch {
		return "system";
	}
}

function persistThemePreference(preference: ThemePreference): void {
	try {
		if (preference === "system") localStorage.removeItem(ThemePreferenceKey);
		else localStorage.setItem(ThemePreferenceKey, preference);
	} catch {
		// The in-memory preference still applies when storage is unavailable.
	}
}

function applyTheme(theme: ResolvedTheme): void {
	document.documentElement.classList.toggle("dark", theme === "dark");
	const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	const color = themeColor?.dataset[theme];
	if (themeColor && color) themeColor.content = color;
}

export function useThemePreference(): Readonly<{
	preference: ThemePreference;
	setPreference: (preference: ThemePreference) => void;
}> {
	const [preference, setPreferenceState] = useState<ThemePreference>("system");
	const [ready, setReady] = useState(false);

	useEffect(() => {
		setPreferenceState(readThemePreference());
		setReady(true);
	}, []);

	useEffect(() => {
		if (!ready) return;
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const synchronize = () => applyTheme(resolveThemePreference(preference, media.matches));
		synchronize();
		if (preference !== "system") return;
		media.addEventListener("change", synchronize);
		return () => media.removeEventListener("change", synchronize);
	}, [preference, ready]);

	const setPreference = useCallback((nextPreference: ThemePreference) => {
		persistThemePreference(nextPreference);
		setPreferenceState(nextPreference);
	}, []);

	return { preference, setPreference } as const;
}
