import type { PortableTextBlock } from "@portabletext/schema";
import MarkdownIt from "markdown-it";
import { editorFailure, editorSuccess, type EditorResult } from "../core";
import type {
	RezicsMarkdownDiagnostic,
	RezicsMarkdownDiagnosticCode,
	RezicsPortableTextValue,
} from "./types";

const blockStyles = new Set(["normal", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"]);
const listItems = new Set(["bullet", "number", "task"]);
const decorators = new Set(["strong", "em", "code", "strike-through"]);
const alignmentValues = new Set(["left", "center", "right"]);
const markdownValidator = new MarkdownIt({ html: true, linkify: true, typographer: false });

function isMarkdownDestination(value: string): boolean {
	return markdownValidator.validateLink(value);
}

function isBlockHtml(value: string): boolean {
	const tokens = markdownValidator.parse(value, {});
	return tokens.length === 1 && tokens[0]?.type === "html_block";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function diagnostic(
	code: RezicsMarkdownDiagnosticCode,
	path: readonly (string | number)[],
	details?: Readonly<Record<string, string | number | boolean>>,
): RezicsMarkdownDiagnostic {
	return {
		code,
		severity: "error",
		location: { kind: "portable-text", path },
		...(details ? { details } : {}),
	};
}

function validateKnownFields(
	value: Record<string, unknown>,
	allowedFields: readonly string[],
	path: readonly (string | number)[],
	diagnostics: RezicsMarkdownDiagnostic[],
): void {
	for (const field of Object.keys(value))
		if (!allowedFields.includes(field))
			diagnostics.push(
				diagnostic("portable-text.invalid-field", [...path, field], {
					expected: "known-field",
					field,
				}),
			);
}

function validateKey(
	value: Record<string, unknown>,
	path: readonly (string | number)[],
	diagnostics: RezicsMarkdownDiagnostic[],
): void {
	if (typeof value._key !== "string" || value._key.length === 0)
		diagnostics.push(diagnostic("portable-text.missing-key", [...path, "_key"]));
}

function validateOptionalString(
	value: Record<string, unknown>,
	field: string,
	path: readonly (string | number)[],
	diagnostics: RezicsMarkdownDiagnostic[],
): void {
	if (value[field] !== undefined && typeof value[field] !== "string")
		diagnostics.push(
			diagnostic("portable-text.invalid-field", [...path, field], { expected: "string" }),
		);
}

function validateImage(
	value: Record<string, unknown>,
	path: readonly (string | number)[],
	diagnostics: RezicsMarkdownDiagnostic[],
): void {
	validateKnownFields(value, ["_type", "_key", "src", "alt", "title"], path, diagnostics);
	validateKey(value, path, diagnostics);
	if (typeof value.src !== "string")
		diagnostics.push(
			diagnostic("portable-text.invalid-field", [...path, "src"], { expected: "string" }),
		);
	else if (!isMarkdownDestination(value.src))
		diagnostics.push(
			diagnostic("portable-text.invalid-field", [...path, "src"], {
				expected: "safe-markdown-destination",
			}),
		);
	validateOptionalString(value, "alt", path, diagnostics);
	validateOptionalString(value, "title", path, diagnostics);
}

function validateTextBlock(
	value: Record<string, unknown>,
	path: readonly (string | number)[],
	diagnostics: RezicsMarkdownDiagnostic[],
): void {
	validateKnownFields(
		value,
		["_type", "_key", "children", "markDefs", "style", "listItem", "level", "checked"],
		path,
		diagnostics,
	);
	validateKey(value, path, diagnostics);
	const style = value.style ?? "normal";
	if (typeof style !== "string" || !blockStyles.has(style))
		diagnostics.push(
			diagnostic("portable-text.unknown-style", [...path, "style"], {
				style: typeof style === "string" ? style : typeof style,
			}),
		);

	const listItem = value.listItem;
	if (listItem !== undefined && (typeof listItem !== "string" || !listItems.has(listItem)))
		diagnostics.push(
			diagnostic("portable-text.unknown-list-item", [...path, "listItem"], {
				listItem: typeof listItem === "string" ? listItem : typeof listItem,
			}),
		);
	if (
		value.level !== undefined &&
		(!Number.isInteger(value.level) || typeof value.level !== "number" || value.level < 1)
	)
		diagnostics.push(
			diagnostic("portable-text.invalid-field", [...path, "level"], {
				expected: "positive-integer",
			}),
		);
	if (value.level !== undefined && listItem === undefined)
		diagnostics.push(
			diagnostic("portable-text.invalid-field", [...path, "level"], {
				expected: "list-item-only",
			}),
		);
	if (listItem !== undefined && style === "blockquote")
		diagnostics.push(
			diagnostic("portable-text.invalid-field", [...path, "style"], {
				expected: "non-blockquote-list-style",
			}),
		);
	if (listItem === "task" && value.checked !== undefined && typeof value.checked !== "boolean")
		diagnostics.push(
			diagnostic("portable-text.invalid-field", [...path, "checked"], {
				expected: "boolean",
			}),
		);
	if (listItem !== "task" && value.checked !== undefined)
		diagnostics.push(
			diagnostic("portable-text.invalid-field", [...path, "checked"], {
				expected: "task-list-only",
			}),
		);

	const markKeys = new Set<string>();
	const markPaths = new Map<string, readonly (string | number)[]>();
	if (value.markDefs === undefined) {
		// An omitted markDefs field is equivalent to an empty array.
	} else if (!Array.isArray(value.markDefs)) {
		diagnostics.push(
			diagnostic("portable-text.invalid-field", [...path, "markDefs"], { expected: "array" }),
		);
	} else {
		for (const [index, mark] of value.markDefs.entries()) {
			const markPath = [...path, "markDefs", index];
			if (!isRecord(mark)) {
				diagnostics.push(diagnostic("portable-text.expected-object", markPath));
				continue;
			}
			validateKnownFields(mark, ["_type", "_key", "href", "title"], markPath, diagnostics);
			validateKey(mark, markPath, diagnostics);
			if (typeof mark._key === "string") {
				if (markKeys.has(mark._key))
					diagnostics.push(
						diagnostic("portable-text.invalid-field", [...markPath, "_key"], {
							expected: "unique-key",
						}),
					);
				if (decorators.has(mark._key))
					diagnostics.push(
						diagnostic("portable-text.invalid-field", [...markPath, "_key"], {
							expected: "non-reserved-key",
						}),
					);
				markKeys.add(mark._key);
				markPaths.set(mark._key, markPath);
			}
			if (mark._type !== "link") {
				diagnostics.push(
					diagnostic("portable-text.unknown-annotation", [...markPath, "_type"], {
						type: typeof mark._type === "string" ? mark._type : typeof mark._type,
					}),
				);
				continue;
			}
			if (typeof mark.href !== "string")
				diagnostics.push(
					diagnostic("portable-text.invalid-field", [...markPath, "href"], {
						expected: "string",
					}),
				);
			else if (!isMarkdownDestination(mark.href))
				diagnostics.push(
					diagnostic("portable-text.invalid-field", [...markPath, "href"], {
						expected: "safe-markdown-destination",
					}),
				);
			validateOptionalString(mark, "title", markPath, diagnostics);
		}
	}

	if (!Array.isArray(value.children)) {
		diagnostics.push(
			diagnostic("portable-text.invalid-field", [...path, "children"], { expected: "array" }),
		);
		return;
	}

	const childKeys = new Set<string>();
	const referencedMarkKeys = new Set<string>();
	let codeRunMarkSignature: string | undefined;
	for (const [index, child] of value.children.entries()) {
		const childPath = [...path, "children", index];
		if (!isRecord(child)) {
			diagnostics.push(diagnostic("portable-text.expected-object", childPath));
			continue;
		}
		if (child._type === "image") {
			codeRunMarkSignature = undefined;
			validateImage(child, childPath, diagnostics);
			if (typeof child._key === "string") {
				if (childKeys.has(child._key))
					diagnostics.push(
						diagnostic("portable-text.invalid-field", [...childPath, "_key"], {
							expected: "unique-key",
						}),
					);
				childKeys.add(child._key);
			}
			continue;
		}
		if (child._type !== "span") {
			diagnostics.push(
				diagnostic("portable-text.unknown-block-type", [...childPath, "_type"], {
					type: typeof child._type === "string" ? child._type : typeof child._type,
				}),
			);
			continue;
		}
		validateKnownFields(child, ["_type", "_key", "text", "marks"], childPath, diagnostics);
		validateKey(child, childPath, diagnostics);
		if (typeof child._key === "string") {
			if (childKeys.has(child._key))
				diagnostics.push(
					diagnostic("portable-text.invalid-field", [...childPath, "_key"], {
						expected: "unique-key",
					}),
				);
			childKeys.add(child._key);
		}
		if (typeof child.text !== "string")
			diagnostics.push(
				diagnostic("portable-text.invalid-field", [...childPath, "text"], {
					expected: "string",
				}),
			);
		if (child.marks === undefined) {
			codeRunMarkSignature = undefined;
			continue;
		}
		if (!Array.isArray(child.marks)) {
			codeRunMarkSignature = undefined;
			diagnostics.push(
				diagnostic("portable-text.invalid-field", [...childPath, "marks"], {
					expected: "array",
				}),
			);
			continue;
		}
		const childMarks = new Set<string>();
		let annotationCount = 0;
		for (const [markIndex, mark] of child.marks.entries()) {
			if (typeof mark === "string" && childMarks.has(mark))
				diagnostics.push(
					diagnostic("portable-text.invalid-field", [...childPath, "marks", markIndex], {
						expected: "unique-mark",
					}),
				);
			if (typeof mark === "string") childMarks.add(mark);
			if (typeof mark === "string" && markKeys.has(mark)) {
				referencedMarkKeys.add(mark);
				annotationCount += 1;
			}
			if (typeof mark !== "string" || (!decorators.has(mark) && !markKeys.has(mark)))
				diagnostics.push(
					diagnostic("portable-text.unknown-mark", [...childPath, "marks", markIndex], {
						mark: typeof mark === "string" ? mark : typeof mark,
					}),
				);
		}
		if (annotationCount > 1)
			diagnostics.push(
				diagnostic("portable-text.invalid-field", [...childPath, "marks"], {
					expected: "at-most-one-link-annotation",
				}),
			);
		if (childMarks.has("code") && typeof child.text === "string" && /[\r\n]/u.test(child.text))
			diagnostics.push(
				diagnostic("portable-text.invalid-field", [...childPath, "text"], {
					expected: "single-line-inline-code",
				}),
			);
		if (childMarks.has("code")) {
			const signature = [...childMarks]
				.filter((mark) => mark !== "code")
				.sort()
				.join("\u0000");
			if (codeRunMarkSignature === undefined) codeRunMarkSignature = signature;
			else if (codeRunMarkSignature !== signature)
				diagnostics.push(
					diagnostic("portable-text.invalid-field", [...childPath, "marks"], {
						expected: "uniform-marks-across-inline-code-run",
					}),
				);
		} else codeRunMarkSignature = undefined;
	}
	for (const [markKey, markPath] of markPaths)
		if (!referencedMarkKeys.has(markKey))
			diagnostics.push(
				diagnostic("portable-text.invalid-field", [...markPath, "_key"], {
					expected: "referenced-annotation",
				}),
			);
}

function textBlockContainsLineBreak(value: Record<string, unknown>): boolean {
	return (
		Array.isArray(value.children) &&
		value.children.some(
			(child) =>
				isRecord(child) && typeof child.text === "string" && /[\r\n]/u.test(child.text),
		)
	);
}

function validateTable(
	value: Record<string, unknown>,
	path: readonly (string | number)[],
	diagnostics: RezicsMarkdownDiagnostic[],
	seen: WeakSet<object>,
	depth: number,
): void {
	validateKnownFields(
		value,
		["_type", "_key", "headerRows", "alignment", "rows"],
		path,
		diagnostics,
	);
	validateKey(value, path, diagnostics);
	if (value.headerRows !== undefined && value.headerRows !== 0 && value.headerRows !== 1)
		diagnostics.push(
			diagnostic("portable-text.invalid-table", [...path, "headerRows"], {
				expected: "zero-or-one",
			}),
		);
	if (value.alignment !== undefined) {
		if (!Array.isArray(value.alignment))
			diagnostics.push(
				diagnostic("portable-text.invalid-table", [...path, "alignment"], {
					expected: "array",
				}),
			);
		else
			for (const [index, alignment] of value.alignment.entries())
				if (
					alignment !== null &&
					(typeof alignment !== "string" || !alignmentValues.has(alignment))
				)
					diagnostics.push(
						diagnostic("portable-text.invalid-table", [...path, "alignment", index], {
							expected: "alignment-or-null",
						}),
					);
	}
	if (!Array.isArray(value.rows)) {
		diagnostics.push(
			diagnostic("portable-text.invalid-table", [...path, "rows"], { expected: "array" }),
		);
		return;
	}
	if (value.rows.length === 0)
		diagnostics.push(
			diagnostic("portable-text.invalid-table", [...path, "rows"], {
				expected: "at-least-one-row",
			}),
		);
	const rowKeys = new Set<string>();
	let columnCount: number | undefined;
	for (const [rowIndex, row] of value.rows.entries()) {
		const rowPath = [...path, "rows", rowIndex];
		if (!isRecord(row) || row._type !== "row" || !Array.isArray(row.cells)) {
			diagnostics.push(diagnostic("portable-text.invalid-table", rowPath));
			continue;
		}
		validateKnownFields(row, ["_type", "_key", "cells"], rowPath, diagnostics);
		validateKey(row, rowPath, diagnostics);
		if (row.cells.length === 0)
			diagnostics.push(
				diagnostic("portable-text.invalid-table", [...rowPath, "cells"], {
					expected: "at-least-one-cell",
				}),
			);
		if (columnCount === undefined) columnCount = row.cells.length;
		else if (row.cells.length !== columnCount)
			diagnostics.push(
				diagnostic("portable-text.invalid-table", [...rowPath, "cells"], {
					expected: "consistent-column-count",
				}),
			);
		if (typeof row._key === "string") {
			if (rowKeys.has(row._key))
				diagnostics.push(
					diagnostic("portable-text.invalid-table", [...rowPath, "_key"], {
						expected: "unique-key",
					}),
				);
			rowKeys.add(row._key);
		}
		const cellKeys = new Set<string>();
		for (const [cellIndex, cell] of row.cells.entries()) {
			const cellPath = [...rowPath, "cells", cellIndex];
			if (!isRecord(cell) || cell._type !== "cell" || !Array.isArray(cell.value)) {
				diagnostics.push(diagnostic("portable-text.invalid-table", cellPath));
				continue;
			}
			validateKnownFields(cell, ["_type", "_key", "value"], cellPath, diagnostics);
			validateKey(cell, cellPath, diagnostics);
			if (typeof cell._key === "string") {
				if (cellKeys.has(cell._key))
					diagnostics.push(
						diagnostic("portable-text.invalid-table", [...cellPath, "_key"], {
							expected: "unique-key",
						}),
					);
				cellKeys.add(cell._key);
			}
			if (cell.value.length !== 1) {
				diagnostics.push(
					diagnostic("portable-text.invalid-table", [...cellPath, "value"], {
						expected: "single-text-block",
					}),
				);
			}
			for (const [blockIndex, block] of cell.value.entries()) {
				const blockPath = [...cellPath, "value", blockIndex];
				if (!isRecord(block) || block._type !== "block") {
					diagnostics.push(diagnostic("portable-text.invalid-table", blockPath));
					continue;
				}
				if (
					(block.style !== undefined && block.style !== "normal") ||
					block.listItem !== undefined
				)
					diagnostics.push(
						diagnostic("portable-text.invalid-table", blockPath, {
							expected: "normal-non-list-text-block",
						}),
					);
				if (textBlockContainsLineBreak(block))
					diagnostics.push(
						diagnostic("portable-text.invalid-table", blockPath, {
							expected: "single-line-table-cell",
						}),
					);
				validateBlock(block, blockPath, diagnostics, seen, depth + 1);
			}
		}
	}
	if (
		Array.isArray(value.alignment) &&
		columnCount !== undefined &&
		value.alignment.length !== columnCount
	)
		diagnostics.push(
			diagnostic("portable-text.invalid-table", [...path, "alignment"], {
				expected: "one-entry-per-column",
			}),
		);
}

function validateBlock(
	value: unknown,
	path: readonly (string | number)[],
	diagnostics: RezicsMarkdownDiagnostic[],
	seen: WeakSet<object>,
	depth: number,
): void {
	if (depth > 32) {
		diagnostics.push(diagnostic("portable-text.too-deep", path));
		return;
	}
	if (!isRecord(value)) {
		diagnostics.push(diagnostic("portable-text.expected-object", path));
		return;
	}
	if (seen.has(value)) {
		diagnostics.push(
			diagnostic("portable-text.invalid-field", path, { expected: "acyclic-value" }),
		);
		return;
	}
	seen.add(value);
	switch (value._type) {
		case "block":
			validateTextBlock(value, path, diagnostics);
			break;
		case "code":
			validateKnownFields(value, ["_type", "_key", "code", "language"], path, diagnostics);
			validateKey(value, path, diagnostics);
			if (typeof value.code !== "string")
				diagnostics.push(
					diagnostic("portable-text.invalid-field", [...path, "code"], {
						expected: "string",
					}),
				);
			validateOptionalString(value, "language", path, diagnostics);
			if (typeof value.language === "string" && /[`\r\n]/u.test(value.language))
				diagnostics.push(
					diagnostic("portable-text.invalid-field", [...path, "language"], {
						expected: "markdown-code-info",
					}),
				);
			break;
		case "horizontal-rule":
			validateKnownFields(value, ["_type", "_key"], path, diagnostics);
			validateKey(value, path, diagnostics);
			break;
		case "html":
			validateKnownFields(value, ["_type", "_key", "html"], path, diagnostics);
			validateKey(value, path, diagnostics);
			if (typeof value.html !== "string")
				diagnostics.push(
					diagnostic("portable-text.invalid-field", [...path, "html"], {
						expected: "string",
					}),
				);
			else if (!isBlockHtml(value.html))
				diagnostics.push(
					diagnostic("portable-text.invalid-field", [...path, "html"], {
						expected: "block-html",
					}),
				);
			break;
		case "image":
			validateImage(value, path, diagnostics);
			break;
		case "table":
			validateTable(value, path, diagnostics, seen, depth);
			break;
		default:
			diagnostics.push(
				diagnostic("portable-text.unknown-block-type", [...path, "_type"], {
					type: typeof value._type === "string" ? value._type : typeof value._type,
				}),
			);
	}
}

/**
 * Prove that unknown input is serializable without loss as REZICS Markdown v1.
 *
 * @alpha
 */
export function decodeRezicsPortableText(
	value: unknown,
): EditorResult<RezicsPortableTextValue, RezicsMarkdownDiagnostic> {
	if (!Array.isArray(value))
		return editorFailure([diagnostic("portable-text.expected-array", [])]);

	const diagnostics: RezicsMarkdownDiagnostic[] = [];
	const seen = new WeakSet<object>();
	const blockKeys = new Set<string>();
	let previousListLevel = 0;
	for (const [index, block] of value.entries()) {
		validateBlock(block, [index], diagnostics, seen, 0);
		if (isRecord(block) && block._type === "block" && block.listItem !== undefined) {
			const level = typeof block.level === "number" ? block.level : 1;
			if (level > previousListLevel + 1)
				diagnostics.push(
					diagnostic("portable-text.invalid-field", [index, "level"], {
						expected: "contiguous-list-level",
					}),
				);
			previousListLevel = level;
		} else previousListLevel = 0;
		if (isRecord(block) && typeof block._key === "string") {
			if (blockKeys.has(block._key))
				diagnostics.push(
					diagnostic("portable-text.invalid-field", [index, "_key"], {
						expected: "unique-key",
					}),
				);
			blockKeys.add(block._key);
		}
	}
	const [first, ...rest] = diagnostics;
	if (first) return editorFailure([first, ...rest]);

	// The brand is introduced only after every reachable node has passed the profile proof above.
	return editorSuccess(value as Array<PortableTextBlock> as RezicsPortableTextValue);
}
