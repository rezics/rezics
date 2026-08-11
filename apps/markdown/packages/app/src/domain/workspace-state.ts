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

export type MarkdownWorkspaceOperation =
	| { readonly kind: "idle" }
	| { readonly kind: "opening" }
	| { readonly kind: "saving"; readonly saveAs: boolean };

export type MarkdownWorkspaceNotice =
	| { readonly kind: "saved" }
	| { readonly kind: "storage-error"; readonly code: MarkdownStorageErrorCode };

export interface MarkdownWorkspaceState {
	/** The exact decoded Markdown source text; the only editable authority. */
	readonly source: string;
	readonly mode: MarkdownEditingMode;
	readonly file: MarkdownFileBinding;
	readonly dirty: boolean;
	readonly revision: number;
	readonly operation: MarkdownWorkspaceOperation;
	readonly notice?: MarkdownWorkspaceNotice;
}

export type MarkdownWorkspaceAction =
	| { readonly type: "new"; readonly name: string; readonly source: string }
	| { readonly type: "edit"; readonly source: string }
	| { readonly type: "set-mode"; readonly mode: MarkdownEditingMode }
	| { readonly type: "operation-started"; readonly operation: MarkdownWorkspaceOperation }
	| {
			readonly type: "opened";
			readonly opened: OpenedMarkdownDocument;
			readonly revision: number;
	  }
	| { readonly type: "saved"; readonly saved: SavedMarkdownDocument; readonly revision: number }
	| { readonly type: "storage-failed"; readonly code: MarkdownStorageErrorCode }
	| { readonly type: "clear-notice" };

export function createMarkdownWorkspaceState(name: string, source: string): MarkdownWorkspaceState {
	return {
		source,
		mode: "source",
		file: { kind: "untitled", name },
		dirty: false,
		revision: 0,
		operation: { kind: "idle" },
	};
}

export function markdownWorkspaceReducer(
	state: MarkdownWorkspaceState,
	action: MarkdownWorkspaceAction,
): MarkdownWorkspaceState {
	switch (action.type) {
		case "new": {
			const next = createMarkdownWorkspaceState(action.name, action.source);
			return { ...next, mode: state.mode, revision: state.revision + 1 };
		}
		case "edit":
			if (action.source === state.source) return state;
			return {
				...state,
				source: action.source,
				dirty: true,
				revision: state.revision + 1,
				notice: undefined,
			};
		case "set-mode":
			return action.mode === state.mode
				? state
				: { ...state, mode: action.mode, notice: undefined };
		case "operation-started":
			return { ...state, operation: action.operation, notice: undefined };
		case "opened":
			if (action.revision !== state.revision)
				return { ...state, operation: { kind: "idle" } };
			return {
				source: action.opened.source,
				mode: state.mode,
				file: {
					kind: "stored",
					storageId: action.opened.storageId,
					name: action.opened.name,
					fingerprint: action.opened.fingerprint,
					canOverwrite: action.opened.canOverwrite,
				},
				dirty: false,
				revision: state.revision + 1,
				operation: { kind: "idle" },
			};
		case "saved":
			return {
				...state,
				file: {
					kind: "stored",
					storageId: action.saved.storageId,
					name: action.saved.name,
					fingerprint: action.saved.fingerprint,
					canOverwrite: action.saved.canOverwrite,
				},
				dirty: action.revision === state.revision ? false : state.dirty,
				operation: { kind: "idle" },
				notice: { kind: "saved" },
			};
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
