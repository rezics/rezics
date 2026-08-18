import { MarkdownEditorApp } from "@rezics/markdown-editor-app";
import { StrictMode, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserMarkdownStorage } from "./browser-storage";
import { tauriNativeMenuHost } from "./native-menu";
import { createTauriMarkdownStorage } from "./tauri-storage";
import {
	applyMarkdownTheme,
	installMarkdownTheme,
	readMarkdownThemePreference,
	writeMarkdownThemePreference,
	type MarkdownThemePreference,
} from "./theme";
import "./styles.css";

const uninstallTheme = installMarkdownTheme(document, window);
if (import.meta.hot) import.meta.hot.dispose(uninstallTheme);

function isTauriRuntime(): boolean {
	return typeof Reflect.get(globalThis, "__TAURI_INTERNALS__") === "object";
}

const container = document.getElementById("root");
if (!(container instanceof HTMLElement)) throw new Error("Markdown editor root is missing");

const storage = isTauriRuntime() ? createTauriMarkdownStorage() : createBrowserMarkdownStorage();

function MarkdownHost(): ReactElement {
	const [themePreference, setThemePreference] = useState<MarkdownThemePreference>(() =>
		readMarkdownThemePreference(window.localStorage),
	);
	const changeTheme = (preference: MarkdownThemePreference): void => {
		writeMarkdownThemePreference(window.localStorage, preference);
		applyMarkdownTheme(document, window);
		setThemePreference(preference);
	};

	return (
		<MarkdownEditorApp
			nativeMenu={isTauriRuntime() ? tauriNativeMenuHost : undefined}
			onThemePreferenceChange={changeTheme}
			storage={storage}
			themePreference={themePreference}
		/>
	);
}

createRoot(container).render(
	<StrictMode>
		<MarkdownHost />
	</StrictMode>,
);
