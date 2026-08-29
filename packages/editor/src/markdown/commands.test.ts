// @vitest-environment jsdom

import { EditorState } from "@codemirror/state";
import { EditorView, type Command } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import {
	insertMarkdownLink,
	rezicsMarkdownKeyBindings,
	setMarkdownHeading,
	toggleMarkdownBulletList,
	toggleMarkdownStrong,
} from "./commands";

const views: EditorView[] = [];

function runCommand(
	document: string,
	selection: { readonly anchor: number; readonly head?: number },
	command: Command,
): EditorView {
	const parent = window.document.createElement("div");
	window.document.body.append(parent);
	const view = new EditorView({
		parent,
		state: EditorState.create({
			doc: document,
			selection: { anchor: selection.anchor, head: selection.head ?? selection.anchor },
		}),
	});
	views.push(view);
	command(view);
	return view;
}

afterEach(() => {
	for (const view of views.splice(0)) {
		view.dom.parentElement?.remove();
		view.destroy();
	}
});

describe("REZICS Markdown source commands", () => {
	it("keeps handled formatting shortcuts inside the editor", () => {
		expect(rezicsMarkdownKeyBindings.every((binding) => binding.stopPropagation)).toBe(true);
	});

	it("wraps and unwraps a selected strong span", () => {
		const wrapped = runCommand("hello", { anchor: 0, head: 5 }, toggleMarkdownStrong);
		expect(wrapped.state.doc.toString()).toBe("**hello**");

		const unwrapped = runCommand("**hello**", { anchor: 0, head: 9 }, toggleMarkdownStrong);
		expect(unwrapped.state.doc.toString()).toBe("hello");
	});

	it("selects the placeholder for an empty link", () => {
		const view = runCommand("", { anchor: 0 }, insertMarkdownLink);
		expect(view.state.doc.toString()).toBe("[link text](https://)");
		expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
			"link text",
		);
	});

	it("toggles headings and line prefixes across selections", () => {
		const heading = runCommand("first\nsecond", { anchor: 0, head: 12 }, setMarkdownHeading(2));
		expect(heading.state.doc.toString()).toBe("## first\n## second");

		const list = runCommand("first\nsecond", { anchor: 0, head: 12 }, toggleMarkdownBulletList);
		expect(list.state.doc.toString()).toBe("- first\n- second");
	});

	it("adds a line prefix only where a mixed selection is missing it", () => {
		const view = runCommand("- first\nsecond", { anchor: 0, head: 14 }, toggleMarkdownBulletList);
		expect(view.state.doc.toString()).toBe("- first\n- second");
	});
});
