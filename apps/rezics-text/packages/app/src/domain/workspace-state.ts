import type {
	MarkdownStorageErrorCode,
	OpenedMarkdownDocument,
	SavedMarkdownDocument,
} from "../storage";

export type MarkdownEditingMode = "source" | "preview";

export type MarkdownFileBinding =
	| { readonly kind: "untitled"; readonly name: string }
	| {
			readonly kind: "stored";
			readonly storageId: string;
			readonly name: string;
			readonly fingerprint: string;
			readonly canOverwrite: boolean;
	  };

export interface MarkdownOpenDocument {
	readonly id: string;
	readonly source: string;
	readonly file: MarkdownFileBinding;
	readonly dirty: boolean;
	readonly revision: number;
	readonly folderId?: string;
}

export interface MarkdownWorkspaceFolder {
	readonly id: string;
	readonly name: string;
	readonly expanded: boolean;
}

export type MarkdownWorkspaceOperation =
	| { readonly kind: "idle" }
	| { readonly kind: "opening" }
	| { readonly kind: "saving"; readonly saveAs: boolean };

export type MarkdownWorkspaceNotice =
	| { readonly kind: "saved" }
	| { readonly kind: "storage-error"; readonly code: MarkdownStorageErrorCode };

export interface MarkdownWorkspaceState {
	/** Open session documents. Empty after the final document is closed. */
	readonly documents: readonly MarkdownOpenDocument[];
	readonly folders: readonly MarkdownWorkspaceFolder[];
	readonly activeId: string | undefined;
	readonly mode: MarkdownEditingMode;
	readonly operation: MarkdownWorkspaceOperation;
	readonly notice?: MarkdownWorkspaceNotice;
}

export type MarkdownWorkspaceAction =
	| {
			readonly type: "new";
			readonly id: string;
			readonly name: string;
			readonly source: string;
			readonly folderId?: string;
	  }
	| { readonly type: "new-folder"; readonly id: string; readonly name: string }
	| { readonly type: "toggle-folder"; readonly id: string }
	| { readonly type: "edit"; readonly source: string }
	| { readonly type: "set-mode"; readonly mode: MarkdownEditingMode }
	| { readonly type: "activate"; readonly id: string }
	| { readonly type: "close"; readonly id: string }
	| { readonly type: "close-all" }
	| { readonly type: "operation-started"; readonly operation: MarkdownWorkspaceOperation }
	| {
			readonly type: "opened";
			readonly id: string;
			readonly opened: OpenedMarkdownDocument;
			readonly replaceActive: boolean;
			readonly folderId?: string;
	  }
	| {
			readonly type: "saved";
			readonly id: string;
			readonly saved: SavedMarkdownDocument;
			readonly revision: number;
	  }
	| { readonly type: "storage-failed"; readonly code: MarkdownStorageErrorCode }
	| { readonly type: "clear-notice" };

export function createMarkdownOpenDocument(
	id: string,
	name: string,
	source: string,
	folderId?: string,
): MarkdownOpenDocument {
	return {
		id,
		source,
		file: { kind: "untitled", name },
		dirty: false,
		revision: 0,
		...(folderId ? { folderId } : {}),
	};
}

export function createMarkdownWorkspaceState(
	name: string,
	source: string,
	id = "document-0",
): MarkdownWorkspaceState {
	const document = createMarkdownOpenDocument(id, name, source);
	return {
		documents: [document],
		folders: [],
		activeId: document.id,
		mode: "preview",
		operation: { kind: "idle" },
	};
}

export function activeMarkdownDocument(
	state: MarkdownWorkspaceState,
): MarkdownOpenDocument | undefined {
	return state.documents.find((document) => document.id === state.activeId);
}

export function markdownWorkspaceIsDirty(state: MarkdownWorkspaceState): boolean {
	return state.documents.some((document) => document.dirty);
}

export function allocateUntitledName(existingNames: readonly string[], baseName: string): string {
	if (!existingNames.includes(baseName)) return baseName;
	const extensionAt = baseName.lastIndexOf(".");
	const stem = extensionAt === -1 ? baseName : baseName.slice(0, extensionAt);
	const extension = extensionAt === -1 ? "" : baseName.slice(extensionAt);
	let serial = 2;
	let candidate = `${stem} ${serial}${extension}`;
	while (existingNames.includes(candidate)) {
		serial += 1;
		candidate = `${stem} ${serial}${extension}`;
	}
	return candidate;
}

function storedFileBinding(
	document: OpenedMarkdownDocument | SavedMarkdownDocument,
): Extract<MarkdownFileBinding, { readonly kind: "stored" }> {
	return {
		kind: "stored",
		storageId: document.storageId,
		name: document.name,
		fingerprint: document.fingerprint,
		canOverwrite: document.canOverwrite,
	};
}

function documentFromOpened(
	id: string,
	opened: OpenedMarkdownDocument,
	folderId?: string,
): MarkdownOpenDocument {
	return {
		id,
		source: opened.source,
		file: storedFileBinding(opened),
		dirty: false,
		revision: 0,
		...(folderId ? { folderId } : {}),
	};
}

function mapOpenDocument(
	documents: readonly MarkdownOpenDocument[],
	id: string,
	update: (document: MarkdownOpenDocument) => MarkdownOpenDocument,
): readonly MarkdownOpenDocument[] {
	return documents.map((document) => (document.id === id ? update(document) : document));
}

export function markdownWorkspaceReducer(
	state: MarkdownWorkspaceState,
	action: MarkdownWorkspaceAction,
): MarkdownWorkspaceState {
	switch (action.type) {
		case "new": {
			const document = createMarkdownOpenDocument(
				action.id,
				action.name,
				action.source,
				action.folderId,
			);
			return {
				...state,
				documents: [...state.documents, document],
				folders: action.folderId
					? state.folders.map((folder) =>
							folder.id === action.folderId ? { ...folder, expanded: true } : folder,
						)
					: state.folders,
				activeId: document.id,
				notice: undefined,
			};
		}
		case "new-folder": {
			if (state.folders.some((folder) => folder.id === action.id)) return state;
			return {
				...state,
				folders: [...state.folders, { id: action.id, name: action.name, expanded: true }],
				notice: undefined,
			};
		}
		case "toggle-folder": {
			if (!state.folders.some((folder) => folder.id === action.id)) return state;
			return {
				...state,
				folders: state.folders.map((folder) =>
					folder.id === action.id ? { ...folder, expanded: !folder.expanded } : folder,
				),
			};
		}
		case "edit": {
			const active = activeMarkdownDocument(state);
			if (!active) return state;
			if (action.source === active.source) return state;
			return {
				...state,
				documents: mapOpenDocument(state.documents, active.id, (document) => ({
					...document,
					source: action.source,
					dirty: true,
					revision: document.revision + 1,
				})),
				notice: undefined,
			};
		}
		case "set-mode":
			return action.mode === state.mode
				? state
				: { ...state, mode: action.mode, notice: undefined };
		case "activate":
			if (action.id === state.activeId) return state;
			if (!state.documents.some((document) => document.id === action.id)) return state;
			return { ...state, activeId: action.id, notice: undefined };
		case "close": {
			const closedIndex = state.documents.findIndex((document) => document.id === action.id);
			if (closedIndex < 0) return state;
			const remaining = state.documents.filter((document) => document.id !== action.id);
			const nextActive =
				state.activeId === action.id
					? (remaining[closedIndex] ?? remaining[closedIndex - 1])?.id
					: state.activeId;
			return {
				...state,
				documents: remaining,
				activeId: nextActive,
				notice: undefined,
			};
		}
		case "close-all":
			return { ...state, documents: [], activeId: undefined, notice: undefined };
		case "operation-started":
			return { ...state, operation: action.operation, notice: undefined };
		case "opened": {
			const existing = state.documents.find(
				(document) =>
					document.file.kind === "stored" && document.file.storageId === action.opened.storageId,
			);
			if (existing) {
				return {
					...state,
					activeId: existing.id,
					operation: { kind: "idle" },
					notice: undefined,
				};
			}
			const opened = documentFromOpened(action.id, action.opened, action.folderId);
			if (action.replaceActive && state.activeId !== undefined) {
				return {
					...state,
					documents: mapOpenDocument(state.documents, state.activeId, () => opened),
					activeId: opened.id,
					operation: { kind: "idle" },
				};
			}
			return {
				...state,
				documents: [...state.documents, opened],
				activeId: opened.id,
				operation: { kind: "idle" },
			};
		}
		case "saved": {
			const target = state.documents.find((document) => document.id === action.id);
			if (!target) {
				return { ...state, operation: { kind: "idle" }, notice: { kind: "saved" } };
			}
			return {
				...state,
				documents: mapOpenDocument(state.documents, action.id, (document) => ({
					...document,
					file: storedFileBinding(action.saved),
					dirty: action.revision === document.revision ? false : document.dirty,
				})),
				operation: { kind: "idle" },
				notice: { kind: "saved" },
			};
		}
		case "storage-failed":
			return {
				...state,
				operation: { kind: "idle" },
				notice: { kind: "storage-error", code: action.code },
			};
		case "clear-notice":
			return { ...state, notice: undefined };
	}
}
