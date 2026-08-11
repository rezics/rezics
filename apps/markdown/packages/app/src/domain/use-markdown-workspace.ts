import { useCallback, useReducer, useRef } from "react";
import type { MarkdownEditorMessages } from "../i18n/messages";
import type { MarkdownDocumentStorage } from "../storage";
import {
	createMarkdownWorkspaceState,
	markdownWorkspaceReducer,
	type MarkdownEditingMode,
} from "./workspace-state";

export function useMarkdownWorkspace(
	storage: MarkdownDocumentStorage,
	messages: MarkdownEditorMessages,
) {
	const [state, dispatch] = useReducer(markdownWorkspaceReducer, undefined, () =>
		createMarkdownWorkspaceState(messages.untitledName, messages.welcomeDocument),
	);
	const storageOperationRef = useRef(false);

	const confirmDiscard = useCallback(
		() => !state.dirty || window.confirm(messages.prompts.discardChanges),
		[messages.prompts.discardChanges, state.dirty],
	);

	const newDocument = useCallback(() => {
		if (storageOperationRef.current || !confirmDiscard()) return;
		dispatch({ type: "new", name: messages.untitledName, source: "" });
	}, [confirmDiscard, messages.untitledName]);

	const openDocument = useCallback(async () => {
		if (storageOperationRef.current || !confirmDiscard()) return;
		storageOperationRef.current = true;
		const openRevision = state.revision;
		dispatch({ type: "operation-started", operation: { kind: "opening" } });
		try {
			const result = await storage.openDocument();
			if (!result.ok) {
				dispatch({ type: "storage-failed", code: result.error.code });
				return;
			}
			if (!result.value) {
				dispatch({ type: "operation-started", operation: { kind: "idle" } });
				return;
			}
			dispatch({ type: "opened", opened: result.value, revision: openRevision });
		} catch {
			dispatch({ type: "storage-failed", code: "io" });
		} finally {
			storageOperationRef.current = false;
		}
	}, [confirmDiscard, state.revision, storage]);

	const saveDocument = useCallback(
		async (forceSaveAs = false) => {
			if (storageOperationRef.current) return;
			storageOperationRef.current = true;
			const saveRevision = state.revision;
			const canSaveExisting =
				!forceSaveAs && state.file.kind === "stored" && state.file.canOverwrite;
			dispatch({
				type: "operation-started",
				operation: { kind: "saving", saveAs: !canSaveExisting },
			});
			try {
				const result = canSaveExisting
					? await storage.saveDocument({
							storageId: state.file.storageId,
							expectedFingerprint: state.file.fingerprint,
							source: state.source,
						})
					: await storage.saveDocumentAs({
							suggestedName: state.file.name,
							source: state.source,
						});
				if (!result.ok) {
					dispatch({ type: "storage-failed", code: result.error.code });
					return;
				}
				if (!result.value) {
					dispatch({ type: "operation-started", operation: { kind: "idle" } });
					return;
				}
				dispatch({ type: "saved", saved: result.value, revision: saveRevision });
			} catch {
				dispatch({ type: "storage-failed", code: "io" });
			} finally {
				storageOperationRef.current = false;
			}
		},
		[state.file, state.revision, state.source, storage],
	);

	const setMode = useCallback((mode: MarkdownEditingMode) => {
		dispatch({ type: "set-mode", mode });
	}, []);

	const edit = useCallback((source: string) => {
		dispatch({ type: "edit", source });
	}, []);

	return {
		state,
		actions: {
			newDocument,
			openDocument,
			saveDocument,
			setMode,
			edit,
			clearNotice: () => dispatch({ type: "clear-notice" }),
		},
	};
}
