import { useCallback, useReducer, useRef } from "react";
import type { RezicsTextMessages } from "../i18n/messages";
import type { MarkdownDocumentStorage } from "../storage";
import {
	activeMarkdownDocument,
	allocateUntitledName,
	createMarkdownWorkspaceState,
	markdownWorkspaceIsDirty,
	markdownWorkspaceReducer,
	type MarkdownEditingMode,
} from "./workspace-state";

export function useMarkdownWorkspace(
	storage: MarkdownDocumentStorage,
	messages: RezicsTextMessages,
) {
	const [state, dispatch] = useReducer(markdownWorkspaceReducer, undefined, () =>
		createMarkdownWorkspaceState(messages.untitledName, messages.sampleDocument),
	);
	const storageOperationRef = useRef(false);
	const nextDocumentSerialRef = useRef(1);
	const stateRef = useRef(state);
	stateRef.current = state;

	const allocateDocumentId = useCallback(() => {
		const id = `document-${nextDocumentSerialRef.current}`;
		nextDocumentSerialRef.current += 1;
		return id;
	}, []);

	const nextFolderSerialRef = useRef(1);
	const allocateFolderId = useCallback(() => {
		const id = `folder-${nextFolderSerialRef.current}`;
		nextFolderSerialRef.current += 1;
		return id;
	}, []);

	const newDocument = useCallback(
		(folderId?: string) => {
			if (storageOperationRef.current) return;
			dispatch({
				type: "new",
				id: allocateDocumentId(),
				name: allocateUntitledName(
					state.documents.map((document) => document.file.name),
					messages.untitledName,
				),
				source: "",
				folderId,
			});
		},
		[allocateDocumentId, messages.untitledName, state.documents],
	);

	const newFolder = useCallback(() => {
		if (storageOperationRef.current) return undefined;
		const id = allocateFolderId();
		dispatch({
			type: "new-folder",
			id,
			name: allocateUntitledName(
				state.folders.map((folder) => folder.name),
				messages.newFolderName,
			),
		});
		return id;
	}, [allocateFolderId, messages.newFolderName, state.folders]);

	const toggleFolder = useCallback((id: string) => {
		dispatch({ type: "toggle-folder", id });
	}, []);

	const openDocument = useCallback(async () => {
		if (storageOperationRef.current) return;
		storageOperationRef.current = true;
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
			const current = stateRef.current;
			const active = activeMarkdownDocument(current);
			dispatch({
				type: "opened",
				id: allocateDocumentId(),
				opened: result.value,
				replaceActive:
					current.documents.length === 1 &&
					current.folders.length === 0 &&
					active?.file.kind === "untitled" &&
					!active.dirty,
			});
		} catch {
			dispatch({ type: "storage-failed", code: "io" });
		} finally {
			storageOperationRef.current = false;
		}
	}, [allocateDocumentId, storage]);

	const saveDocument = useCallback(
		async (forceSaveAs = false) => {
			if (storageOperationRef.current) return;
			const target = activeMarkdownDocument(state);
			if (!target) return;
			storageOperationRef.current = true;
			const saveRevision = target.revision;
			const canSaveExisting =
				!forceSaveAs && target.file.kind === "stored" && target.file.canOverwrite;
			dispatch({
				type: "operation-started",
				operation: { kind: "saving", saveAs: !canSaveExisting },
			});
			try {
				const result = canSaveExisting
					? await storage.saveDocument({
							storageId: target.file.storageId,
							expectedFingerprint: target.file.fingerprint,
							source: target.source,
						})
					: await storage.saveDocumentAs({
							suggestedName: target.file.name,
							source: target.source,
						});
				if (!result.ok) {
					dispatch({ type: "storage-failed", code: result.error.code });
					return;
				}
				if (!result.value) {
					dispatch({ type: "operation-started", operation: { kind: "idle" } });
					return;
				}
				dispatch({
					type: "saved",
					id: target.id,
					saved: result.value,
					revision: saveRevision,
				});
			} catch {
				dispatch({ type: "storage-failed", code: "io" });
			} finally {
				storageOperationRef.current = false;
			}
		},
		[state, storage],
	);

	const setMode = useCallback((mode: MarkdownEditingMode) => {
		dispatch({ type: "set-mode", mode });
	}, []);

	const activateDocument = useCallback((id: string) => {
		dispatch({ type: "activate", id });
	}, []);

	const closeAllDocuments = useCallback(() => {
		if (storageOperationRef.current) return;
		if (markdownWorkspaceIsDirty(state) && !window.confirm(messages.prompts.discardChanges)) return;
		dispatch({ type: "close-all" });
	}, [messages.prompts.discardChanges, state]);

	const closeDocument = useCallback(
		(id: string) => {
			if (storageOperationRef.current) return;
			const target = state.documents.find((document) => document.id === id);
			if (!target) return;
			if (target.dirty && !window.confirm(messages.prompts.discardChanges)) return;
			dispatch({ type: "close", id });
		},
		[messages.prompts.discardChanges, state.documents],
	);

	const edit = useCallback((source: string) => {
		dispatch({ type: "edit", source });
	}, []);

	return {
		state,
		active: activeMarkdownDocument(state),
		actions: {
			newDocument,
			newFolder,
			toggleFolder,
			openDocument,
			saveDocument,
			setMode,
			activateDocument,
			closeDocument,
			closeAllDocuments,
			edit,
			clearNotice: () => dispatch({ type: "clear-notice" }),
		},
	};
}
