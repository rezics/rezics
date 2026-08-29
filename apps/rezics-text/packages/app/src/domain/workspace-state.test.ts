import { describe, expect, it } from "vitest";
import {
	activeMarkdownDocument as findActiveMarkdownDocument,
	allocateUntitledName,
	createMarkdownWorkspaceState,
	markdownWorkspaceIsDirty,
	markdownWorkspaceReducer,
	type MarkdownOpenDocument,
	type MarkdownWorkspaceState,
} from "./workspace-state";

function activeMarkdownDocument(state: MarkdownWorkspaceState): MarkdownOpenDocument {
	const document = findActiveMarkdownDocument(state);
	if (!document) throw new Error("Expected an active Markdown document");
	return document;
}

const stored = {
	storageId: "opaque-1",
	name: "note.md",
	fingerprint: "fingerprint-1",
	canOverwrite: true,
} as const;

describe("Markdown workspace state", () => {
	it("starts in live preview with one exact Markdown source", () => {
		const initial = createMarkdownWorkspaceState("note.md", "**xx**");
		expect(initial.mode).toBe("preview");
		expect(activeMarkdownDocument(initial).source).toBe("**xx**");
		expect(initial.documents).toHaveLength(1);

		const source = markdownWorkspaceReducer(initial, {
			type: "set-mode",
			mode: "source",
		});
		expect(activeMarkdownDocument(source).source).toBe("**xx**");
		expect(source.mode).toBe("source");
		expect(source.documents).toHaveLength(1);
	});

	it("ignores a controlled edit that does not change the active source", () => {
		const initial = createMarkdownWorkspaceState("note.md", "same");
		expect(markdownWorkspaceReducer(initial, { type: "edit", source: "same" })).toBe(initial);
	});

	it("keeps an existing document when a new one is created", () => {
		const initial = markdownWorkspaceReducer(createMarkdownWorkspaceState("note.md", "kept"), {
			type: "edit",
			source: "kept edit",
		});
		const created = markdownWorkspaceReducer(initial, {
			type: "new",
			id: "document-1",
			name: "Untitled 2.md",
			source: "",
		});

		expect(created.documents).toHaveLength(2);
		expect(created.activeId).toBe("document-1");
		expect(created.documents[0]?.source).toBe("kept edit");
		expect(created.documents[0]?.dirty).toBe(true);
		expect(activeMarkdownDocument(created).source).toBe("");
		expect(markdownWorkspaceIsDirty(created)).toBe(true);
	});

	it("activates a stored file already in the session instead of opening a second copy", () => {
		const opened = markdownWorkspaceReducer(createMarkdownWorkspaceState("start.md", "start"), {
			type: "opened",
			id: "document-1",
			replaceActive: true,
			opened: { ...stored, source: "text" },
		});
		const second = markdownWorkspaceReducer(opened, {
			type: "new",
			id: "document-2",
			name: "other.md",
			source: "",
		});
		const focused = markdownWorkspaceReducer(second, {
			type: "opened",
			id: "document-3",
			replaceActive: false,
			opened: { ...stored, source: "ignored" },
		});

		expect(focused.documents).toHaveLength(2);
		expect(focused.activeId).toBe("document-1");
		expect(activeMarkdownDocument(focused).source).toBe("text");
	});

	it("replaces a pristine untitled document on first open", () => {
		const initial = createMarkdownWorkspaceState("Untitled.md", "welcome");
		const opened = markdownWorkspaceReducer(initial, {
			type: "opened",
			id: "document-1",
			replaceActive: true,
			opened: { ...stored, source: "from disk" },
		});

		expect(opened.documents).toHaveLength(1);
		expect(opened.activeId).toBe("document-1");
		expect(activeMarkdownDocument(opened).source).toBe("from disk");
	});

	it("models a saved file binding with its conflict fingerprint", () => {
		const initial = createMarkdownWorkspaceState("note.md", "text");
		const dirty = markdownWorkspaceReducer(initial, { type: "edit", source: "changed" });
		const saved = markdownWorkspaceReducer(dirty, {
			type: "saved",
			id: activeMarkdownDocument(dirty).id,
			revision: activeMarkdownDocument(dirty).revision,
			saved: stored,
		});

		expect(activeMarkdownDocument(saved).dirty).toBe(false);
		expect(activeMarkdownDocument(saved).file).toEqual({
			kind: "stored",
			...stored,
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
			id: activeMarkdownDocument(saving).id,
			revision: activeMarkdownDocument(saving).revision,
			saved: {
				...stored,
				fingerprint: "saved-fingerprint",
			},
		});

		expect(activeMarkdownDocument(completed).dirty).toBe(true);
		expect(activeMarkdownDocument(completed).revision).toBe(
			activeMarkdownDocument(editedAgain).revision,
		);
	});

	it("closes the last document without creating a replacement tab", () => {
		const initial = markdownWorkspaceReducer(createMarkdownWorkspaceState("note.md", "text"), {
			type: "edit",
			source: "changed",
		});
		const closed = markdownWorkspaceReducer(initial, {
			type: "close",
			id: activeMarkdownDocument(initial).id,
		});

		expect(closed.documents).toHaveLength(0);
		expect(closed.activeId).toBeUndefined();
		expect(findActiveMarkdownDocument(closed)).toBeUndefined();
	});

	it("creates and edits a new document after the workspace becomes empty", () => {
		const initial = createMarkdownWorkspaceState("note.md", "text");
		const empty = markdownWorkspaceReducer(initial, {
			type: "close",
			id: activeMarkdownDocument(initial).id,
		});
		const created = markdownWorkspaceReducer(empty, {
			type: "new",
			id: "document-1",
			name: "Untitled.md",
			source: "",
		});
		const edited = markdownWorkspaceReducer(created, { type: "edit", source: "new note" });

		expect(created.documents).toHaveLength(1);
		expect(created.activeId).toBe("document-1");
		expect(activeMarkdownDocument(edited).source).toBe("new note");
	});

	it("activates a neighbor when a middle document is closed", () => {
		let state = createMarkdownWorkspaceState("one.md", "one", "document-0");
		state = markdownWorkspaceReducer(state, {
			type: "new",
			id: "document-1",
			name: "two.md",
			source: "two",
		});
		state = markdownWorkspaceReducer(state, {
			type: "new",
			id: "document-2",
			name: "three.md",
			source: "three",
		});
		state = markdownWorkspaceReducer(state, { type: "activate", id: "document-1" });
		const closed = markdownWorkspaceReducer(state, {
			type: "close",
			id: "document-1",
		});

		expect(closed.documents.map((document) => document.id)).toEqual(["document-0", "document-2"]);
		expect(closed.activeId).toBe("document-2");
	});

	it("preserves the selected editing mode across document identity changes", () => {
		const initial = markdownWorkspaceReducer(createMarkdownWorkspaceState("old.md", "old"), {
			type: "set-mode",
			mode: "source",
		});
		const created = markdownWorkspaceReducer(initial, {
			type: "new",
			id: "document-1",
			name: "new.md",
			source: "new",
		});
		expect(created.mode).toBe("source");

		const opened = markdownWorkspaceReducer(created, {
			type: "opened",
			id: "document-2",
			replaceActive: false,
			opened: {
				...stored,
				name: "opened.md",
				source: "opened",
			},
		});
		expect(opened.mode).toBe("source");
		expect(activeMarkdownDocument(opened).source).toBe("opened");
		expect(opened.documents).toHaveLength(3);
	});

	it("creates session folders and places new documents inside them", () => {
		let state = createMarkdownWorkspaceState("note.md", "root");
		state = markdownWorkspaceReducer(state, {
			type: "new-folder",
			id: "folder-1",
			name: "New Folder",
		});
		expect(state.folders).toEqual([{ id: "folder-1", name: "New Folder", expanded: true }]);

		state = markdownWorkspaceReducer(state, {
			type: "new",
			id: "document-1",
			name: "inside.md",
			source: "",
			folderId: "folder-1",
		});
		expect(activeMarkdownDocument(state).folderId).toBe("folder-1");
		expect(state.folders[0]?.expanded).toBe(true);

		const collapsed = markdownWorkspaceReducer(state, {
			type: "toggle-folder",
			id: "folder-1",
		});
		expect(collapsed.folders[0]?.expanded).toBe(false);
	});

	it("closes every document without leaving a replacement tab", () => {
		let state = createMarkdownWorkspaceState("one.md", "one");
		state = markdownWorkspaceReducer(state, {
			type: "new",
			id: "document-1",
			name: "two.md",
			source: "two",
		});
		const closed = markdownWorkspaceReducer(state, { type: "close-all" });
		expect(closed.documents).toHaveLength(0);
		expect(closed.activeId).toBeUndefined();
		expect(findActiveMarkdownDocument(closed)).toBeUndefined();
	});

	it("allocates numbered untitled names without rewriting an unused base", () => {
		expect(allocateUntitledName([], "Untitled.md")).toBe("Untitled.md");
		expect(allocateUntitledName(["Untitled.md"], "Untitled.md")).toBe("Untitled 2.md");
		expect(allocateUntitledName(["Untitled.md", "Untitled 2.md"], "Untitled.md")).toBe(
			"Untitled 3.md",
		);
		expect(allocateUntitledName(["未命名.md"], "未命名.md")).toBe("未命名 2.md");
	});
});
