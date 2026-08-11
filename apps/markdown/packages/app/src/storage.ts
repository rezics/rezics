export const maximumMarkdownDocumentBytes = 16 * 1024 * 1024;

export const markdownStorageErrorCodes = [
	"conflict",
	"invalid-encoding",
	"invalid-response",
	"io",
	"not-found",
	"too-large",
	"unavailable",
	"unsupported-extension",
] as const;

export type MarkdownStorageErrorCode = (typeof markdownStorageErrorCodes)[number];

export interface MarkdownStorageError {
	readonly code: MarkdownStorageErrorCode;
}

export type MarkdownStorageResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: MarkdownStorageError };

export interface OpenedMarkdownDocument {
	readonly storageId: string;
	readonly name: string;
	readonly source: string;
	readonly fingerprint: string;
	readonly canOverwrite: boolean;
}

export interface SavedMarkdownDocument {
	readonly storageId: string;
	readonly name: string;
	readonly fingerprint: string;
	readonly canOverwrite: boolean;
}

export interface SaveMarkdownDocumentRequest {
	readonly storageId: string;
	readonly expectedFingerprint: string;
	readonly source: string;
}

export interface SaveMarkdownDocumentAsRequest {
	readonly suggestedName: string;
	readonly source: string;
}

export interface MarkdownDocumentStorage {
	readonly openDocument: () => Promise<MarkdownStorageResult<OpenedMarkdownDocument | null>>;
	readonly saveDocument: (
		request: SaveMarkdownDocumentRequest,
	) => Promise<MarkdownStorageResult<SavedMarkdownDocument>>;
	readonly saveDocumentAs: (
		request: SaveMarkdownDocumentAsRequest,
	) => Promise<MarkdownStorageResult<SavedMarkdownDocument | null>>;
}

export function markdownStorageSuccess<T>(value: T): MarkdownStorageResult<T> {
	return { ok: true, value };
}

export function markdownStorageFailure(
	code: MarkdownStorageErrorCode,
): MarkdownStorageResult<never> {
	return { ok: false, error: { code } };
}

export function isMarkdownFileName(name: string): boolean {
	const lowerName = name.toLocaleLowerCase("en-US");
	return lowerName.endsWith(".md") || lowerName.endsWith(".markdown");
}

export function normalizeMarkdownFileName(name: string): string {
	const trimmed = name.trim();
	if (isMarkdownFileName(trimmed)) return trimmed;
	return `${trimmed}.md`;
}
