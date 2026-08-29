/// <reference path="./lucide-icons.d.ts" />

export { RezicsTextApp, type RezicsTextAppProps } from "./rezics-text-app";
export {
	isRezicsTextThemePreference,
	rezicsTextThemePreferences,
	type RezicsTextThemePreference,
} from "./domain/appearance";
export {
	isRezicsTextApplicationCommand,
	type RezicsTextApplicationCommand,
	type RezicsTextNativeMenuHost,
} from "./domain/application-menu";
export {
	applicationCommandAccelerator,
	applicationCommandFromShortcut,
	applicationCommandShortcutLabel,
	type RezicsTextShortcutEvent,
} from "./domain/application-shortcuts";
export {
	rezicsTextLocales,
	rezicsTextMessages,
	resolveRezicsTextLocale,
	type RezicsTextLocale,
	type RezicsTextMessages,
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
