import type { PortableTextBlock } from "@portabletext/schema";
import type { EditorDiagnostic } from "../core";

declare const rezicsPortableTextValueBrand: unique symbol;

/**
 * Portable Text proven at runtime to fit the loss-aware REZICS Markdown v1 profile.
 *
 * @alpha
 */
export type RezicsPortableTextValue = Array<PortableTextBlock> & {
	readonly [rezicsPortableTextValueBrand]: true;
};

/** @alpha */
export type RezicsMarkdownDiagnosticCode =
	| "markdown.byte-order-mark-rich-mode-unsupported"
	| "markdown.inline-html-unsupported"
	| "markdown.soft-break-rich-mode-unsupported"
	| "markdown.ordered-list-start-unsupported"
	| "markdown.structure-unsupported"
	| "markdown.conversion-failed"
	| "portable-text.expected-array"
	| "portable-text.expected-object"
	| "portable-text.missing-key"
	| "portable-text.unknown-block-type"
	| "portable-text.unknown-style"
	| "portable-text.unknown-list-item"
	| "portable-text.invalid-field"
	| "portable-text.unknown-mark"
	| "portable-text.unknown-annotation"
	| "portable-text.invalid-table"
	| "portable-text.too-deep"
	| "portable-text.conversion-failed";

/** @alpha */
export type RezicsMarkdownDiagnostic = EditorDiagnostic<RezicsMarkdownDiagnosticCode>;

/** @alpha */
export interface RezicsMarkdownConversionOptions {
	/** Stable key generation is useful for deterministic fixtures and import pipelines. */
	readonly keyGenerator?: () => string;
}

/** @alpha */
export interface RezicsMarkdownSourceDocument {
	readonly mode: "source";
	readonly source: string;
}

/** @alpha */
export interface RezicsMarkdownRichDocument {
	readonly mode: "rich";
	readonly value: RezicsPortableTextValue;
}

/** @alpha */
export type RezicsMarkdownDocument = RezicsMarkdownSourceDocument | RezicsMarkdownRichDocument;
