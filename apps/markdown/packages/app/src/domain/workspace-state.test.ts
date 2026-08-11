import { describe, expect, it } from "vitest";
import { createMarkdownWorkspaceState, markdownWorkspaceReducer } from "./workspace-state";

describe("Markdown workspace state", () => {
	it("keeps one exact Markdown source across source and live-preview modes", () => {
		const initial = createMarkdownWorkspaceState("note.md", "**xx**");
		const preview = markdownWorkspaceReducer(initial, {
			type: "set-mode",
			mode: "preview",
		});

		expect(preview.source).toBe("**xx**");
		expect(preview.mode).toBe("preview");
		expect(preview.revision).toBe(initial.revision);
		expect(preview.dirty).toBe(false);

		const edited = markdownWorkspaceReducer(preview, {
			type: "edit",
			source: "*xx**",
		});
		expect(edited.source).toBe("*xx**");
		expect(edited.mode).toBe("preview");
		expect(edited.dirty).toBe(true);
	});

	it("ignores a controlled edit that does not change the source", () => {
		const initial = createMarkdownWorkspaceState("note.md", "same");
		expect(markdownWorkspaceReducer(initial, { type: "edit", source: "same" })).toBe(initial);
	});

	it("models a saved file binding with its conflict fingerprint", () => {
		const initial = createMarkdownWorkspaceState("note.md", "text");
		const dirty = markdownWorkspaceReducer(initial, { type: "edit", source: "changed" });
		const saved = markdownWorkspaceReducer(dirty, {
			type: "saved",
			revision: dirty.revision,
			saved: {
				storageId: "opaque-1",
				name: "note.md",
				fingerprint: "fingerprint-1",
				canOverwrite: true,
			},
		});

		expect(saved.dirty).toBe(false);
		expect(saved.file).toEqual({
			kind: "stored",
			storageId: "opaque-1",
			name: "note.md",
			fingerprint: "fingerprint-1",
			canOverwrite: true,
		});
	});

	it("keeps newer edits dirty when an older async save completes", () => {
		const initial = createMarkdownWorkspaceState("note.md", "before");
		const saving = markdownWorkspaceReducer(initial, { type: "edit", source: "saved" });
		const editedAgain = markdownWorkspaceReducer(saving, {
			type: "edit",
			source: "newer edit",
		});
		const completed = markdownWorkspaceReducer(editedAgain, {
			type: "saved",
			revision: saving.revision,
			saved: {
				storageId: "opaque-1",
				name: "note.md",
				fingerprint: "saved-fingerprint",
				canOverwrite: true,
			},
		});

		expect(completed.dirty).toBe(true);
		expect(completed.revision).toBe(editedAgain.revision);
	});

	it("does not let a stale open replace newer source", () => {
		const initial = createMarkdownWorkspaceState("note.md", "before");
		const edited = markdownWorkspaceReducer(initial, {
			type: "edit",
			source: "newer edit",
		});
		const opening = markdownWorkspaceReducer(edited, {
			type: "operation-started",
			operation: { kind: "opening" },
		});
		const staleOpen = markdownWorkspaceReducer(opening, {
			type: "opened",
			revision: initial.revision,
			opened: {
				storageId: "opaque-1",
				name: "other.md",
				source: "other",
				fingerprint: "fingerprint-1",
				canOverwrite: true,
			},
		});

		expect(staleOpen.source).toBe(edited.source);
		expect(staleOpen.operation).toEqual({ kind: "idle" });
	});

	it("preserves the selected editing mode across document identity changes", () => {
		const initial = markdownWorkspaceReducer(createMarkdownWorkspaceState("old.md", "old"), {
			type: "set-mode",
			mode: "preview",
		});
		const replacement = markdownWorkspaceReducer(initial, {
			type: "new",
			name: "new.md",
			source: "new",
		});
		expect(replacement.mode).toBe("preview");

		const opened = markdownWorkspaceReducer(replacement, {
			type: "opened",
			revision: replacement.revision,
			opened: {
				storageId: "opaque-1",
				name: "opened.md",
				source: "opened",
				fingerprint: "fingerprint-1",
				canOverwrite: true,
			},
		});
		expect(opened.mode).toBe("preview");
		expect(opened.source).toBe("opened");
	});
});
