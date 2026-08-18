/// <reference path="./lucide-icons.d.ts" />

export { MarkdownEditorApp, type MarkdownEditorAppProps } from "./markdown-editor-app";
export {
	isMarkdownThemePreference,
	markdownThemePreferences,
	type MarkdownThemePreference,
} from "./domain/appearance";
export {
	isMarkdownApplicationCommand,
	type MarkdownApplicationCommand,
	type MarkdownNativeMenuHost,
} from "./domain/application-menu";
export {
	markdownEditorLocales,
	markdownEditorMessages,
	resolveMarkdownEditorLocale,
	type MarkdownEditorLocale,
	type MarkdownEditorMessages,
} from "./i18n/messages";
export type {
	MarkdownDocumentStorage,
	MarkdownStorageError,
	MarkdownStorageErrorCode,
	MarkdownStorageResult,
	OpenedMarkdownDocument,
	SavedMarkdownDocument,
	SaveMarkdownDocumentAsRequest,
	SaveMarkdownDocumentRequest,
} from "./storage";
export {
	isMarkdownFileName,
	markdownStorageErrorCodes,
	markdownStorageFailure,
	markdownStorageSuccess,
	maximumMarkdownDocumentBytes,
	normalizeMarkdownFileName,
} from "./storage";
