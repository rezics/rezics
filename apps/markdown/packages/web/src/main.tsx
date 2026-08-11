import { MarkdownEditorApp } from "@rezics/markdown-editor-app";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserMarkdownStorage } from "./browser-storage";
import { createTauriMarkdownStorage } from "./tauri-storage";
import { installMarkdownTheme } from "./theme";
import "./styles.css";

const uninstallTheme = installMarkdownTheme(document, window);
if (import.meta.hot) import.meta.hot.dispose(uninstallTheme);

function isTauriRuntime(): boolean {
	return typeof Reflect.get(globalThis, "__TAURI_INTERNALS__") === "object";
}

const container = document.getElementById("root");
if (!(container instanceof HTMLElement)) throw new Error("Markdown editor root is missing");

const storage = isTauriRuntime() ? createTauriMarkdownStorage() : createBrowserMarkdownStorage();

createRoot(container).render(
	<StrictMode>
		<MarkdownEditorApp storage={storage} />
	</StrictMode>,
);
