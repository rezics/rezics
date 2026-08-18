import { appTheme, appThemeCss } from "@rezics/ui/theme";
import {
	isMarkdownThemePreference,
	type MarkdownThemePreference,
} from "@rezics/markdown-editor-app";

export type { MarkdownThemePreference };
export type MarkdownColorScheme = Exclude<MarkdownThemePreference, "system">;

export const markdownThemeStorageKey = "rezics-theme";
const markdownThemeStyleId = "rezics-app-theme";

export function resolveMarkdownColorScheme(
	preference: MarkdownThemePreference,
	systemPrefersDark: boolean,
): MarkdownColorScheme {
	if (preference === "system") return systemPrefersDark ? "dark" : "light";
	return preference;
}

export function markdownThemeColor(scheme: MarkdownColorScheme): string {
	return appTheme[scheme].background;
}

export function readMarkdownThemePreference(storage: Storage): MarkdownThemePreference {
	try {
		const stored = storage.getItem(markdownThemeStorageKey);
		return isMarkdownThemePreference(stored) ? stored : "system";
	} catch {
		return "system";
	}
}

export function writeMarkdownThemePreference(
	storage: Storage,
	preference: MarkdownThemePreference,
): void {
	try {
		storage.setItem(markdownThemeStorageKey, preference);
	} catch {
		// Ignore quota or private-mode failures; the session preference still applies.
	}
}

export function applyMarkdownTheme(targetDocument: Document, targetWindow: Window): void {
	const scheme = resolveMarkdownColorScheme(
		readMarkdownThemePreference(targetWindow.localStorage),
		targetWindow.matchMedia("(prefers-color-scheme: dark)").matches,
	);
	targetDocument.documentElement.classList.toggle("dark", scheme === "dark");
	targetDocument.documentElement.dataset.theme = scheme;
	const themeColor = targetDocument.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	if (themeColor) themeColor.content = markdownThemeColor(scheme);
}

/** Installs the shared semantic theme before React renders and keeps system mode current. */
export function installMarkdownTheme(targetDocument: Document, targetWindow: Window): () => void {
	let themeStyle = targetDocument.getElementById(markdownThemeStyleId);
	if (!(themeStyle instanceof HTMLStyleElement)) {
		themeStyle = targetDocument.createElement("style");
		themeStyle.id = markdownThemeStyleId;
		themeStyle.textContent = appThemeCss;
		targetDocument.head.prepend(themeStyle);
	}

	const darkMedia = targetWindow.matchMedia("(prefers-color-scheme: dark)");
	const applyTheme = (): void => {
		applyMarkdownTheme(targetDocument, targetWindow);
	};
	const onStorage = (event: StorageEvent): void => {
		if (event.key === null || event.key === markdownThemeStorageKey) applyTheme();
	};

	applyTheme();
	darkMedia.addEventListener("change", applyTheme);
	targetWindow.addEventListener("storage", onStorage);
	return () => {
		darkMedia.removeEventListener("change", applyTheme);
		targetWindow.removeEventListener("storage", onStorage);
	};
}
