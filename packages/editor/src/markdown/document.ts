import { editorSuccess, type EditorResult } from "../core";
import { markdownToRezicsPortableText, rezicsPortableTextToMarkdown } from "./codec";
import type {
	RezicsMarkdownConversionOptions,
	RezicsMarkdownDiagnostic,
	RezicsMarkdownDocument,
	RezicsMarkdownSourceDocument,
} from "./types";

/** @alpha */
export function createRezicsMarkdownDocument(source = ""): RezicsMarkdownSourceDocument {
	return { mode: "source", source };
}

/**
 * Perform an explicit authority handoff between CodeMirror source and Portable Text rich modes.
 *
 * @alpha
 */
export function convertRezicsMarkdownDocument(
	document: RezicsMarkdownDocument,
	targetMode: "source" | "rich",
	options: RezicsMarkdownConversionOptions = {},
): EditorResult<RezicsMarkdownDocument, RezicsMarkdownDiagnostic> {
	if (document.mode === targetMode) return editorSuccess(document);
	if (document.mode === "source") {
		const converted = markdownToRezicsPortableText(document.source, options);
		return converted.ok
			? editorSuccess({ mode: "rich", value: converted.value }, converted.diagnostics)
			: converted;
	}
	const converted = rezicsPortableTextToMarkdown(document.value);
	return converted.ok
		? editorSuccess({ mode: "source", source: converted.value }, converted.diagnostics)
		: converted;
}
