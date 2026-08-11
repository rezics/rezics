import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension, type Range } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from "@codemirror/view";

export interface MarkdownLivePreviewRange {
	readonly from: number;
	readonly to: number;
}

type MarkdownSyntaxNode = ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]>;

const revealContainerNames = new Set([
	"ATXHeading1",
	"ATXHeading2",
	"ATXHeading3",
	"ATXHeading4",
	"ATXHeading5",
	"ATXHeading6",
	"SetextHeading1",
	"SetextHeading2",
	"StrongEmphasis",
	"Emphasis",
	"Strikethrough",
	"InlineCode",
	"Link",
	"Image",
	"Autolink",
	"Blockquote",
	"ListItem",
	"FencedCode",
	"CodeBlock",
	"HorizontalRule",
	"Escape",
]);

const inlineClassByNodeName: Readonly<Record<string, string>> = {
	StrongEmphasis: "cm-rezics-md-strong",
	Emphasis: "cm-rezics-md-emphasis",
	Strikethrough: "cm-rezics-md-strikethrough",
	InlineCode: "cm-rezics-md-inline-code",
	Link: "cm-rezics-md-link",
	Autolink: "cm-rezics-md-link",
	Image: "cm-rezics-md-image",
};

const hiddenSyntaxNodeNames = new Set([
	"HeaderMark",
	"EmphasisMark",
	"StrikethroughMark",
	"CodeMark",
	"QuoteMark",
	"LinkMark",
	"ListMark",
	"TaskMarker",
]);

const hiddenSyntaxDecoration = Decoration.replace({
	inclusive: false,
	rezicsMarkdownKind: "hidden-syntax",
});
const activeSyntaxDecoration = Decoration.mark({
	class: "cm-rezics-md-syntax cm-rezics-md-syntax-active",
	rezicsMarkdownKind: "active-syntax",
});

class MarkdownMarkerWidget extends WidgetType {
	readonly text: string;
	readonly className: string;

	constructor(text: string, className: string) {
		super();
		this.text = text;
		this.className = className;
	}

	eq(other: WidgetType): boolean {
		return (
			other instanceof MarkdownMarkerWidget &&
			other.text === this.text &&
			other.className === this.className
		);
	}

	toDOM(): HTMLElement {
		const marker = document.createElement("span");
		marker.ariaHidden = "true";
		marker.className = this.className;
		marker.textContent = this.text;
		return marker;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

function selectionTouchesNode(state: EditorState, node: MarkdownSyntaxNode): boolean {
	return state.selection.ranges.some((range) =>
		range.empty
			? range.head >= node.from && range.head <= node.to
			: range.from < node.to && range.to > node.from,
	);
}

function revealContainer(node: MarkdownSyntaxNode): MarkdownSyntaxNode | undefined {
	let current: MarkdownSyntaxNode | null = node;
	while (current) {
		if (revealContainerNames.has(current.name)) return current;
		current = current.parent;
	}
	return undefined;
}

function parentNamed(node: MarkdownSyntaxNode, ...names: readonly string[]): boolean {
	let current = node.parent;
	while (current) {
		if (names.includes(current.name)) return true;
		if (revealContainerNames.has(current.name)) return false;
		current = current.parent;
	}
	return false;
}

function clippedRange(
	from: number,
	to: number,
	visibleRange: MarkdownLivePreviewRange,
): MarkdownLivePreviewRange | undefined {
	const clippedFrom = Math.max(from, visibleRange.from);
	const clippedTo = Math.min(to, visibleRange.to);
	return clippedFrom < clippedTo ? { from: clippedFrom, to: clippedTo } : undefined;
}

/**
 * Builds viewport-bounded decorations for the source-backed Markdown live preview.
 * Exported for deterministic extension tests; applications should use
 * {@link rezicsMarkdownLivePreview}.
 */
export function buildMarkdownLivePreviewDecorations(
	state: EditorState,
	visibleRanges: readonly MarkdownLivePreviewRange[],
): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const decorationKeys = new Set<string>();

	const addDecoration = (kind: string, decoration: Decoration, from: number, to = from): void => {
		const key = `${kind}:${from}:${to}`;
		if (decorationKeys.has(key)) return;
		decorationKeys.add(key);
		decorations.push(decoration.range(from, to));
	};

	const addVisibleMark = (
		kind: string,
		className: string,
		from: number,
		to: number,
		visibleRange: MarkdownLivePreviewRange,
	): void => {
		const clipped = clippedRange(from, to, visibleRange);
		if (!clipped) return;
		addDecoration(
			kind,
			Decoration.mark({ class: className, rezicsMarkdownKind: kind }),
			clipped.from,
			clipped.to,
		);
	};

	const addVisibleLines = (
		kind: string,
		className: string,
		from: number,
		to: number,
		visibleRange: MarkdownLivePreviewRange,
	): void => {
		const clipped = clippedRange(from, Math.max(from + 1, to), visibleRange);
		if (!clipped) return;
		let line = state.doc.lineAt(clipped.from);
		while (line.from <= clipped.to) {
			addDecoration(
				`${kind}:${className}`,
				Decoration.line({ class: className, rezicsMarkdownKind: kind }),
				line.from,
			);
			if (line.to >= clipped.to || line.number >= state.doc.lines) break;
			line = state.doc.line(line.number + 1);
		}
	};

	for (const visibleRange of visibleRanges) {
		syntaxTree(state).iterate({
			from: visibleRange.from,
			to: visibleRange.to,
			enter: (reference) => {
				const node = reference.node;
				const inlineClass = inlineClassByNodeName[node.name];
				if (inlineClass)
					addVisibleMark(
						`inline:${node.name}`,
						inlineClass,
						node.from,
						node.to,
						visibleRange,
					);

				const heading = /^(?:ATX|Setext)Heading([1-6])$/u.exec(node.name)?.[1];
				if (heading) {
					const firstLine = state.doc.lineAt(node.from).from;
					addDecoration(
						`heading:${heading}`,
						Decoration.line({
							class: `cm-rezics-md-heading cm-rezics-md-heading-${heading}`,
							rezicsMarkdownKind: "heading",
						}),
						firstLine,
					);
				}

				if (node.name === "Blockquote")
					addVisibleLines(
						"blockquote",
						"cm-rezics-md-quote-line",
						node.from,
						node.to,
						visibleRange,
					);
				if (node.name === "FencedCode" || node.name === "CodeBlock")
					addVisibleLines(
						"code-block",
						"cm-rezics-md-code-line",
						node.from,
						node.to,
						visibleRange,
					);

				if (node.name === "HorizontalRule") {
					if (selectionTouchesNode(state, node)) {
						addDecoration(
							"active-horizontal-rule",
							activeSyntaxDecoration,
							node.from,
							node.to,
						);
					} else {
						addDecoration(
							"horizontal-rule",
							Decoration.replace({
								widget: new MarkdownMarkerWidget(
									"\u200b",
									"cm-rezics-md-horizontal-rule",
								),
								rezicsMarkdownKind: "horizontal-rule",
							}),
							node.from,
							node.to,
						);
					}
					return;
				}

				if (node.name === "Escape") {
					if (selectionTouchesNode(state, node)) {
						addDecoration("active-escape", activeSyntaxDecoration, node.from, node.to);
					} else if (node.to > node.from + 1) {
						addDecoration(
							"hidden-escape",
							hiddenSyntaxDecoration,
							node.from,
							node.from + 1,
						);
					}
					return;
				}

				const isLinkTarget = node.name === "URL" && parentNamed(node, "Link", "Image");
				const isCodeInfo = node.name === "CodeInfo" && parentNamed(node, "FencedCode");
				if (!hiddenSyntaxNodeNames.has(node.name) && !isLinkTarget && !isCodeInfo) return;

				const container = revealContainer(node);
				if (!container || selectionTouchesNode(state, container)) {
					addDecoration(
						`active-syntax:${node.name}`,
						activeSyntaxDecoration,
						node.from,
						node.to,
					);
					return;
				}

				if (node.name === "ListMark") {
					if (container.name === "ListItem" && container.getChild("Task")) {
						addDecoration(
							"hidden-task-list-marker",
							hiddenSyntaxDecoration,
							node.from,
							node.to,
						);
						return;
					}
					const sourceMarker = state.doc.sliceString(node.from, node.to);
					const renderedMarker = /^\d/u.test(sourceMarker) ? sourceMarker : "•";
					addDecoration(
						"list-marker",
						Decoration.replace({
							widget: new MarkdownMarkerWidget(
								renderedMarker,
								"cm-rezics-md-list-marker",
							),
							rezicsMarkdownKind: "list-marker",
						}),
						node.from,
						node.to,
					);
					return;
				}

				if (node.name === "TaskMarker") {
					const checked = /x/iu.test(state.doc.sliceString(node.from, node.to));
					addDecoration(
						"task-marker",
						Decoration.replace({
							widget: new MarkdownMarkerWidget(
								checked ? "☑" : "☐",
								"cm-rezics-md-task-marker",
							),
							rezicsMarkdownKind: "task-marker",
						}),
						node.from,
						node.to,
					);
					return;
				}

				if (
					node.name === "CodeMark" &&
					container.name === "FencedCode" &&
					node.to - node.from >= 3
				) {
					const lineStart = state.doc.lineAt(node.from).from;
					addDecoration(
						"hidden-code-fence-line",
						Decoration.line({
							class: "cm-rezics-md-code-fence-hidden",
							rezicsMarkdownKind: "hidden-code-fence-line",
						}),
						lineStart,
					);
				}

				let hiddenTo = node.to;
				if (
					(node.name === "HeaderMark" || node.name === "QuoteMark") &&
					hiddenTo < state.doc.length &&
					/[\t ]/u.test(state.doc.sliceString(hiddenTo, hiddenTo + 1)) &&
					node.from === container.from
				)
					hiddenTo += 1;
				addDecoration(
					`hidden-syntax:${node.name}`,
					hiddenSyntaxDecoration,
					node.from,
					hiddenTo,
				);
			},
		});
	}

	return Decoration.set(decorations, true);
}

const markdownLivePreviewPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildMarkdownLivePreviewDecorations(view.state, view.visibleRanges);
		}

		update(update: ViewUpdate): void {
			if (
				update.docChanged ||
				update.selectionSet ||
				update.viewportChanged ||
				syntaxTree(update.startState) !== syntaxTree(update.state)
			)
				this.decorations = buildMarkdownLivePreviewDecorations(
					update.state,
					update.view.visibleRanges,
				);
		}
	},
	{ decorations: (plugin) => plugin.decorations },
);

/** Source-backed Markdown live preview that reveals real syntax at the active selection. */
export function rezicsMarkdownLivePreview(): Extension {
	return markdownLivePreviewPlugin;
}
