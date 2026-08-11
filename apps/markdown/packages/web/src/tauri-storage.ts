import {
	isMarkdownFileName,
	markdownStorageErrorCodes,
	markdownStorageFailure,
	markdownStorageSuccess,
	maximumMarkdownDocumentBytes,
	type MarkdownDocumentStorage,
	type MarkdownStorageErrorCode,
	type OpenedMarkdownDocument,
	type SavedMarkdownDocument,
} from "@rezics/markdown-editor-app";
import { invoke } from "@tauri-apps/api/core";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStorageErrorCode(value: unknown): value is MarkdownStorageErrorCode {
	return (
		typeof value === "string" &&
		markdownStorageErrorCodes.some((errorCode) => errorCode === value)
	);
}

function hasOnlyFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
	return Object.keys(value).every((field) => fields.includes(field));
}

function isStorageId(value: unknown): value is string {
	return (
		typeof value === "string" &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
	);
}

function isFingerprint(value: unknown): value is string {
	return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

function isDocumentName(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		!/[\\/]/u.test(value) &&
		isMarkdownFileName(value)
	);
}

function isSavedDocument(value: unknown): value is SavedMarkdownDocument {
	return (
		isRecord(value) &&
		hasOnlyFields(value, ["storageId", "name", "fingerprint", "canOverwrite"]) &&
		isStorageId(value.storageId) &&
		isDocumentName(value.name) &&
		isFingerprint(value.fingerprint) &&
		typeof value.canOverwrite === "boolean"
	);
}

function isOpenedDocument(value: unknown): value is OpenedMarkdownDocument {
	return (
		isRecord(value) &&
		hasOnlyFields(value, ["storageId", "name", "source", "fingerprint", "canOverwrite"]) &&
		isStorageId(value.storageId) &&
		isDocumentName(value.name) &&
		typeof value.source === "string" &&
		sourceFitsLimit(value.source) &&
		isFingerprint(value.fingerprint) &&
		typeof value.canOverwrite === "boolean"
	);
}

export function decodeTauriStorageError(error: unknown): MarkdownStorageErrorCode {
	if (isRecord(error) && isStorageErrorCode(error.code)) return error.code;
	return "io";
}

function sourceFitsLimit(source: string): boolean {
	return new TextEncoder().encode(source).byteLength <= maximumMarkdownDocumentBytes;
}

export function createTauriMarkdownStorage(): MarkdownDocumentStorage {
	return {
		openDocument: async () => {
			try {
				const value: unknown = await invoke("open_markdown_document");
				if (value === null) return markdownStorageSuccess(null);
				return isOpenedDocument(value)
					? markdownStorageSuccess(value)
					: markdownStorageFailure("invalid-response");
			} catch (error) {
				return markdownStorageFailure(decodeTauriStorageError(error));
			}
		},
		saveDocument: async (request) => {
			if (!sourceFitsLimit(request.source)) return markdownStorageFailure("too-large");
			try {
				const value: unknown = await invoke("save_markdown_document", { request });
				return isSavedDocument(value)
					? markdownStorageSuccess(value)
					: markdownStorageFailure("invalid-response");
			} catch (error) {
				return markdownStorageFailure(decodeTauriStorageError(error));
			}
		},
		saveDocumentAs: async (request) => {
			if (!sourceFitsLimit(request.source)) return markdownStorageFailure("too-large");
			try {
				const value: unknown = await invoke("save_markdown_document_as", { request });
				if (value === null) return markdownStorageSuccess(null);
				return isSavedDocument(value)
					? markdownStorageSuccess(value)
					: markdownStorageFailure("invalid-response");
			} catch (error) {
				return markdownStorageFailure(decodeTauriStorageError(error));
			}
		},
	};
}
