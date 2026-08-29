import { appTheme, appThemeCss } from "@rezics/ui/theme";
import { isRezicsTextThemePreference, type RezicsTextThemePreference } from "@rezics/text-app";

export type { RezicsTextThemePreference };
export type RezicsTextColorScheme = Exclude<RezicsTextThemePreference, "system">;

export const rezicsTextThemeStorageKey = "rezics-theme";
const rezicsTextThemeStyleId = "rezics-text-app-theme";

export function resolveRezicsTextColorScheme(
	preference: RezicsTextThemePreference,
	systemPrefersDark: boolean,
): RezicsTextColorScheme {
	if (preference === "system") return systemPrefersDark ? "dark" : "light";
	return preference;
}

export function rezicsTextThemeColor(scheme: RezicsTextColorScheme): string {
	return appTheme[scheme].background;
}

export function readRezicsTextThemePreference(storage: Storage): RezicsTextThemePreference {
	try {
		const stored = storage.getItem(rezicsTextThemeStorageKey);
		return isRezicsTextThemePreference(stored) ? stored : "system";
	} catch {
		return "system";
	}
}

export function writeRezicsTextThemePreference(
	storage: Storage,
	preference: RezicsTextThemePreference,
): void {
	try {
		storage.setItem(rezicsTextThemeStorageKey, preference);
	} catch {
		// Ignore quota or private-mode failures; the session preference still applies.
	}
}

export function applyRezicsTextTheme(targetDocument: Document, targetWindow: Window): void {
	const scheme = resolveRezicsTextColorScheme(
		readRezicsTextThemePreference(targetWindow.localStorage),
		targetWindow.matchMedia("(prefers-color-scheme: dark)").matches,
	);
	targetDocument.documentElement.classList.toggle("dark", scheme === "dark");
	targetDocument.documentElement.dataset.theme = scheme;
	const themeColor = targetDocument.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	if (themeColor) themeColor.content = rezicsTextThemeColor(scheme);
}

/** Installs the shared semantic theme before React renders and keeps system mode current. */
export function installRezicsTextTheme(targetDocument: Document, targetWindow: Window): () => void {
	let themeStyle = targetDocument.getElementById(rezicsTextThemeStyleId);
	if (!(themeStyle instanceof HTMLStyleElement)) {
		themeStyle = targetDocument.createElement("style");
		themeStyle.id = rezicsTextThemeStyleId;
		themeStyle.textContent = appThemeCss;
		targetDocument.head.prepend(themeStyle);
	}

	const darkMedia = targetWindow.matchMedia("(prefers-color-scheme: dark)");
	const applyTheme = (): void => {
		applyRezicsTextTheme(targetDocument, targetWindow);
	};
	const onStorage = (event: StorageEvent): void => {
		if (event.key === null || event.key === rezicsTextThemeStorageKey) applyTheme();
	};

	applyTheme();
	darkMedia.addEventListener("change", applyTheme);
	targetWindow.addEventListener("storage", onStorage);
	return () => {
		darkMedia.removeEventListener("change", applyTheme);
		targetWindow.removeEventListener("storage", onStorage);
	};
}
