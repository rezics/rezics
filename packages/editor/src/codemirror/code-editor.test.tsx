// @vitest-environment jsdom

import { undo, undoDepth } from "@codemirror/commands";
import type { Extension } from "@codemirror/state";
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rezicsMarkdown } from "../markdown/language";
import { rezicsMarkdownLivePreview } from "../markdown/live-preview";
import { CodeEditor, type CodeEditorHandle } from "./code-editor";

const sourceExtensions: readonly Extension[] = [rezicsMarkdown()];
const previewExtensions: readonly Extension[] = [rezicsMarkdown(), rezicsMarkdownLivePreview()];
const reactTestGlobal = globalThis as typeof globalThis & {
	IS_REACT_ACT_ENVIRONMENT: boolean;
};

describe("CodeEditor extension reconfiguration", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.append(container);
	});

	afterEach(() => {
		container.remove();
		vi.restoreAllMocks();
	});

	it("keeps the same view, selection, source, and undo history across preview modes", () => {
		const root = createRoot(container);
		const editorRef = createRef<CodeEditorHandle>();
		let controlledValue = "**xx**";
		const onChange = vi.fn((value: string) => {
			controlledValue = value;
		});
		const render = (extensions: readonly Extension[]): void => {
			act(() => {
				root.render(
					<CodeEditor
						ariaLabel="Markdown editor"
						extensions={extensions}
						onChange={onChange}
						ref={editorRef}
						value={controlledValue}
					/>,
				);
			});
		};

		render(sourceExtensions);
		const sourceView = editorRef.current?.getView();
		expect(sourceView).not.toBeNull();
		if (!sourceView) return;

		act(() => {
			sourceView.dispatch({
				changes: { from: 0, to: 1 },
				selection: { anchor: 2 },
			});
		});
		expect(controlledValue).toBe("*xx**");
		expect(undoDepth(sourceView.state)).toBe(1);

		render(previewExtensions);
		const previewView = editorRef.current?.getView();
		expect(previewView).toBe(sourceView);
		expect(previewView?.state.doc.toString()).toBe("*xx**");
		expect(previewView?.state.selection.main.head).toBe(2);
		expect(previewView ? undoDepth(previewView.state) : 0).toBe(1);

		act(() => {
			expect(previewView ? undo(previewView) : false).toBe(true);
		});
		expect(previewView?.state.doc.toString()).toBe("**xx**");

		act(() => root.unmount());
	});

	it("removes the default dotted perimeter when the editor is focused", () => {
		const root = createRoot(container);
		const editorRef = createRef<CodeEditorHandle>();
		act(() => {
			root.render(
				<CodeEditor
					ariaLabel="Markdown editor"
					onChange={() => undefined}
					ref={editorRef}
					value=""
				/>,
			);
		});
		const view = editorRef.current?.getView();
		expect(view).not.toBeNull();
		if (!view) return;

		view.dom.classList.add("cm-focused");
		expect(getComputedStyle(view.dom).outlineStyle).toBe("none");

		act(() => root.unmount());
	});

	it("updates localized placeholder guidance without recreating the editor", () => {
		const root = createRoot(container);
		const editorRef = createRef<CodeEditorHandle>();
		const render = (placeholder: string): void => {
			act(() => {
				root.render(
					<CodeEditor
						ariaLabel="Markdown editor"
						onChange={() => undefined}
						placeholder={placeholder}
						ref={editorRef}
						value=""
					/>,
				);
			});
		};

		render("Start writing…");
		const view = editorRef.current?.getView();
		expect(container.querySelector(".cm-placeholder")?.textContent).toBe("Start writing…");

		render("开始写作……");
		expect(editorRef.current?.getView()).toBe(view);
		expect(container.querySelector(".cm-placeholder")?.textContent).toBe("开始写作……");

		act(() => root.unmount());
	});
});
