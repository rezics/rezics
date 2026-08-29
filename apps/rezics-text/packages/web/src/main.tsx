import { RezicsTextApp } from "@rezics/text-app";
import { StrictMode, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserMarkdownStorage } from "./browser-storage";
import { tauriNativeMenuHost } from "./native-menu";
import { createTauriMarkdownStorage } from "./tauri-storage";
import {
	applyRezicsTextTheme,
	installRezicsTextTheme,
	readRezicsTextThemePreference,
	writeRezicsTextThemePreference,
	type RezicsTextThemePreference,
} from "./theme";
import "./styles.css";

const uninstallTheme = installRezicsTextTheme(document, window);
if (import.meta.hot) import.meta.hot.dispose(uninstallTheme);

function isTauriRuntime(): boolean {
	return typeof Reflect.get(globalThis, "__TAURI_INTERNALS__") === "object";
}

const container = document.getElementById("root");
if (!(container instanceof HTMLElement)) throw new Error("REZICS Text root is missing");

const storage = isTauriRuntime() ? createTauriMarkdownStorage() : createBrowserMarkdownStorage();

function RezicsTextHost(): ReactElement {
	const [themePreference, setThemePreference] = useState<RezicsTextThemePreference>(() =>
		readRezicsTextThemePreference(window.localStorage),
	);
	const changeTheme = (preference: RezicsTextThemePreference): void => {
		writeRezicsTextThemePreference(window.localStorage, preference);
		applyRezicsTextTheme(document, window);
		setThemePreference(preference);
	};

	return (
		<RezicsTextApp
			nativeMenu={isTauriRuntime() ? tauriNativeMenuHost : undefined}
			onThemePreferenceChange={changeTheme}
			storage={storage}
			themePreference={themePreference}
		/>
	);
}

createRoot(container).render(
	<StrictMode>
		<RezicsTextHost />
	</StrictMode>,
);
