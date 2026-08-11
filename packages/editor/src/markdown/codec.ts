import { markdownToPortableText, type ObjectMatcher } from "@portabletext/markdown";
import MarkdownIt from "markdown-it";
import { editorFailure, editorSuccess, type EditorResult } from "../core";
import { decodeRezicsPortableText } from "./portable-text-validation";
import { rezicsMarkdownSchema } from "./schema";
import { serializeRezicsPortableText } from "./serialize";
import type {
	RezicsMarkdownConversionOptions,
	RezicsMarkdownDiagnostic,
	RezicsPortableTextValue,
} from "./types";

const markdownScanner = new MarkdownIt({ html: true, linkify: true, typographer: false });
type MarkdownToken = ReturnType<typeof markdownScanner.parse>[number];

function tokenDiagnostic(
	code:
		| "markdown.inline-html-unsupported"
		| "markdown.ordered-list-start-unsupported"
		| "markdown.soft-break-rich-mode-unsupported"
		| "markdown.structure-unsupported",
	token: MarkdownToken,
	details?: Readonly<Record<string, string | number | boolean>>,
): RezicsMarkdownDiagnostic {
	const firstLine = token.map?.[0];
	return {
		code,
		severity: "error",
		location: {
			kind: "markdown",
			...(firstLine === undefined ? {} : { line: firstLine + 1 }),
		},
		...(details ? { details } : {}),
	};
}

function inlineHtmlDiagnostics(tokens: readonly MarkdownToken[]): RezicsMarkdownDiagnostic[] {
	const diagnostics: RezicsMarkdownDiagnostic[] = [];
	for (const token of tokens) {
		if (token.children?.some((child) => child.type === "html_inline"))
			diagnostics.push(tokenDiagnostic("markdown.inline-html-unsupported", token));
		if (token.children?.some((child) => child.type === "softbreak"))
			diagnostics.push(tokenDiagnostic("markdown.soft-break-rich-mode-unsupported", token));
	}
	return diagnostics;
}

function findClosingToken(
	tokens: readonly MarkdownToken[],
	openIndex: number,
	openType: string,
	closeType: string,
): number {
	let depth = 1;
	for (let index = openIndex + 1; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (!token) continue;
		if (token.type === openType) depth += 1;
		else if (token.type === closeType) {
			depth -= 1;
			if (depth === 0) return index;
		}
	}
	return tokens.length;
}

function structureDiagnostics(
	tokens: readonly MarkdownToken[],
	sourceLines: readonly string[],
): RezicsMarkdownDiagnostic[] {
	const diagnostics: RezicsMarkdownDiagnostic[] = [];
	for (let index = 1; index < tokens.length; index += 1) {
		const previous = tokens[index - 1];
		const current = tokens[index];
		if (
			previous &&
			current &&
			previous.level === 0 &&
			current.level === 0 &&
			previous.type === "blockquote_close" &&
			current.type === "blockquote_open"
		)
			diagnostics.push(
				tokenDiagnostic("markdown.structure-unsupported", current, {
					construct: "separate-adjacent-container",
				}),
			);
	}
	for (const [index, token] of tokens.entries()) {
		if (token.type === "ordered_list_open") {
			const start = Number(token.attrGet("start") ?? 1);
			if (start !== 1)
				diagnostics.push(
					tokenDiagnostic("markdown.ordered-list-start-unsupported", token, { start }),
				);
		}

		if (token.type === "bullet_list_open" || token.type === "ordered_list_open") {
			const closeType =
				token.type === "bullet_list_open" ? "bullet_list_close" : "ordered_list_close";
			const closeIndex = findClosingToken(tokens, index, token.type, closeType);
			const directContentLevel = token.level + 2;
			if (
				tokens
					.slice(index + 1, closeIndex)
					.some(
						(candidate) =>
							candidate.type === "paragraph_open" &&
							candidate.level === directContentLevel &&
							!candidate.hidden,
					)
			)
				diagnostics.push(
					tokenDiagnostic("markdown.structure-unsupported", token, {
						construct: "loose-list",
					}),
				);
		}

		if (token.type === "blockquote_open") {
			const closeIndex = findClosingToken(
				tokens,
				index,
				"blockquote_open",
				"blockquote_close",
			);
			const allowedTypes = new Set(["paragraph_open", "paragraph_close", "inline"]);
			const unsupported = tokens
				.slice(index + 1, closeIndex)
				.find((candidate) => !allowedTypes.has(candidate.type));
			if (unsupported)
				diagnostics.push(
					tokenDiagnostic("markdown.structure-unsupported", token, {
						construct: "complex-blockquote",
					}),
				);
		}

		if (token.type === "bullet_list_open") {
			const closeIndex = findClosingToken(
				tokens,
				index,
				"bullet_list_open",
				"bullet_list_close",
			);
			const directItemLevel = token.level + 1;
			const taskFlags = tokens
				.slice(index + 1, closeIndex)
				.filter(
					(candidate) =>
						candidate.type === "list_item_open" && candidate.level === directItemLevel,
				)
				.map((candidate) => {
					const line = candidate.map?.[0];
					return line === undefined
						? false
						: /^\s*[-+*]\s+\[[ xX]\](?:[ \t]+|$)/u.test(sourceLines[line] ?? "");
				});
			if (taskFlags.some(Boolean) && taskFlags.some((isTask) => !isTask))
				diagnostics.push(
					tokenDiagnostic("markdown.structure-unsupported", token, {
						construct: "mixed-task-list",
					}),
				);
		}

		if (token.type === "list_item_open") {
			const closeIndex = findClosingToken(tokens, index, "list_item_open", "list_item_close");
			const directLevel = token.level + 1;
			let contentBlocks = 0;
			let unsupported = false;
			for (const candidate of tokens.slice(index + 1, closeIndex)) {
				if (candidate.level !== directLevel) continue;
				if (candidate.type === "paragraph_open" || candidate.type === "heading_open") {
					contentBlocks += 1;
					continue;
				}
				if (
					candidate.type === "paragraph_close" ||
					candidate.type === "heading_close" ||
					candidate.type === "bullet_list_open" ||
					candidate.type === "bullet_list_close" ||
					candidate.type === "ordered_list_open" ||
					candidate.type === "ordered_list_close"
				)
					continue;
				unsupported = true;
			}
			if (unsupported || contentBlocks !== 1)
				diagnostics.push(
					tokenDiagnostic("markdown.structure-unsupported", token, {
						construct: "complex-list-item",
					}),
				);
		}
	}
	return diagnostics;
}

function sourceDiagnostics(markdown: string): RezicsMarkdownDiagnostic[] {
	const tokens = markdownScanner.parse(markdown, {});
	const sourceLines = markdown.split(/\r?\n/u);
	const byteOrderMarkDiagnostics: RezicsMarkdownDiagnostic[] = markdown.startsWith("\uFEFF")
		? [
				{
					code: "markdown.byte-order-mark-rich-mode-unsupported",
					severity: "error",
					location: { kind: "markdown", line: 1, column: 1 },
				},
			]
		: [];
	const alertDiagnostics: RezicsMarkdownDiagnostic[] = [];
	for (const [lineIndex, line] of sourceLines.entries())
		if (/^(?: {0,3}>\s*)+\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/iu.test(line))
			alertDiagnostics.push({
				code: "markdown.structure-unsupported",
				severity: "error",
				location: { kind: "markdown", line: lineIndex + 1 },
				details: { construct: "gfm-alert" },
			});
	return [
		...byteOrderMarkDiagnostics,
		...alertDiagnostics,
		...inlineHtmlDiagnostics(tokens),
		...structureDiagnostics(tokens, sourceLines),
	];
}

function conversionFailure(
	code: "markdown.conversion-failed" | "portable-text.conversion-failed",
): EditorResult<never, RezicsMarkdownDiagnostic> {
	return editorFailure([
		{
			code,
			severity: "error",
			location: { kind: "document" },
		},
	]);
}

const tableMatcher: ObjectMatcher<{
	headerRows: number | undefined;
	alignment: Array<"left" | "center" | "right" | null> | undefined;
	rows: Array<{
		_key: string;
		_type: "row";
		cells: Array<{
			_type: "cell";
			_key: string;
			value: Array<import("@portabletext/schema").PortableTextBlock>;
		}>;
	}>;
}> = ({ context, value }) => {
	const schemaType = context.schema.blockObjects.find(
		(blockObject) => blockObject.name === "table",
	);
	if (!schemaType) return undefined;
	return {
		_type: schemaType.name,
		_key: context.keyGenerator(),
		headerRows: value.headerRows,
		alignment: value.alignment,
		rows: value.rows,
	};
};

function inlineTokensToPlainText(tokens: readonly MarkdownToken[]): string {
	let result = "";
	for (const token of tokens) {
		switch (token.type) {
			case "text":
			case "code_inline":
				result += token.content;
				break;
			case "image":
				result += inlineTokensToPlainText(token.children ?? []);
				break;
			case "html_inline":
			case "html_block":
				result += token.content;
				break;
			case "softbreak":
			case "hardbreak":
				result += "\n";
				break;
		}
	}
	return result;
}

function markdownImageAltText(value: string): string {
	const inline = markdownScanner.parseInline(value, {}).find((token) => token.type === "inline");
	return inlineTokensToPlainText(inline?.children ?? []);
}

const imageMatcher: ObjectMatcher<{
	src: string;
	alt?: string;
	title?: string;
}> = ({ context, isInline, value }) => {
	const schemaType = (isInline ? context.schema.inlineObjects : context.schema.blockObjects).find(
		(object) => object.name === "image",
	);
	if (!schemaType) return undefined;
	return {
		_type: schemaType.name,
		_key: context.keyGenerator(),
		src: value.src,
		alt: markdownImageAltText(value.alt ?? ""),
		...(value.title === undefined ? {} : { title: value.title }),
	};
};

/**
 * Convert REZICS Markdown v1 to the package-owned Portable Text profile.
 *
 * @alpha
 */
export function markdownToRezicsPortableText(
	markdown: string,
	options: RezicsMarkdownConversionOptions = {},
): EditorResult<RezicsPortableTextValue, RezicsMarkdownDiagnostic> {
	const diagnostics = sourceDiagnostics(markdown);
	const [firstDiagnostic, ...remainingDiagnostics] = diagnostics;
	if (firstDiagnostic) return editorFailure([firstDiagnostic, ...remainingDiagnostics]);

	try {
		const converted = markdownToPortableText(markdown, {
			schema: rezicsMarkdownSchema,
			...(options.keyGenerator ? { keyGenerator: options.keyGenerator } : {}),
			types: { image: imageMatcher, table: tableMatcher },
			html: { inline: "skip" },
		});
		return decodeRezicsPortableText(converted);
	} catch {
		return conversionFailure("markdown.conversion-failed");
	}
}

/**
 * Serialize proven or unknown Portable Text as REZICS Markdown v1 without silent fallback renderers.
 *
 * @alpha
 */
export function rezicsPortableTextToMarkdown(
	value: unknown,
): EditorResult<string, RezicsMarkdownDiagnostic> {
	const decoded = decodeRezicsPortableText(value);
	if (!decoded.ok) return decoded;
	try {
		return editorSuccess(serializeRezicsPortableText(decoded.value));
	} catch {
		return conversionFailure("portable-text.conversion-failed");
	}
}
