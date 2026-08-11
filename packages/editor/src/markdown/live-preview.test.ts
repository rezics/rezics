import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { rezicsMarkdown } from "./language";
import { buildMarkdownLivePreviewDecorations } from "./live-preview";

interface ObservedDecoration {
	readonly from: number;
	readonly to: number;
	readonly kind: string | undefined;
}

function previewState(source: string, anchor: number): EditorState {
	return EditorState.create({
		doc: source,
		selection: { anchor },
		extensions: [rezicsMarkdown()],
	});
}

function observedDecorations(state: EditorState, from = 0, to = state.doc.length) {
	const observed: ObservedDecoration[] = [];
	buildMarkdownLivePreviewDecorations(state, [{ from, to }]).between(
		0,
		state.doc.length,
		(decorationFrom, decorationTo, decoration) => {
			observed.push({
				from: decorationFrom,
				to: decorationTo,
				kind:
					typeof decoration.spec.rezicsMarkdownKind === "string"
						? decoration.spec.rezicsMarkdownKind
						: undefined,
			});
		},
	);
	return observed;
}

function sourceSlices(
	state: EditorState,
	decorations: readonly ObservedDecoration[],
	kind: string,
): readonly string[] {
	return decorations
		.filter((decoration) => decoration.kind === kind)
		.map((decoration) => state.doc.sliceString(decoration.from, decoration.to));
}

describe("Markdown live preview", () => {
	it("hides inactive strong delimiters without changing the source", () => {
		const source = "plain\n\n**xx**";
		const state = previewState(source, 0);
		const decorations = observedDecorations(state);

		expect(sourceSlices(state, decorations, "hidden-syntax")).toEqual(["**", "**"]);
		expect(decorations.some(({ kind }) => kind === "inline:StrongEmphasis")).toBe(true);
		expect(state.doc.toString()).toBe(source);
	});

	it("reveals the real delimiters when the selection enters formatted text", () => {
		const source = "plain\n\n**xx**";
		const strongStart = source.indexOf("**xx**");
		const state = previewState(source, strongStart + 3);
		const decorations = observedDecorations(state);

		expect(sourceSlices(state, decorations, "hidden-syntax")).not.toContain("**");
		expect(sourceSlices(state, decorations, "active-syntax")).toEqual(["**", "**"]);
	});

	it("keeps malformed Markdown literal and immediately reparses after delimiter deletion", () => {
		const source = "**xx**";
		const changed = previewState(source, 3).update({
			changes: { from: 0, to: 1 },
		}).state;

		expect(changed.doc.toString()).toBe("*xx**");
		expect(sourceSlices(changed, observedDecorations(changed), "hidden-syntax")).not.toContain(
			"**",
		);
	});

	it("handles nested marks, inline code, links, and escapes from the syntax tree", () => {
		const source = "plain\n\n**bold *nested*** `**code**` [label](url) \\*literal\\*";
		const state = previewState(source, 0);
		const decorations = observedDecorations(state);
		const hidden = sourceSlices(state, decorations, "hidden-syntax");

		expect(hidden).toContain("**");
		expect(hidden).toContain("*");
		expect(hidden).toContain("`");
		expect(hidden).toContain("url");
		expect(sourceSlices(state, decorations, "hidden-syntax")).toContain("\\");
		expect(state.doc.toString()).toBe(source);
	});

	it("keeps CJK source offsets exact while revealing its active delimiters", () => {
		const source = "前文 **繁體中文** 後文";
		const state = previewState(source, source.indexOf("中文"));
		const decorations = observedDecorations(state);

		expect(sourceSlices(state, decorations, "active-syntax")).toEqual(["**", "**"]);
		expect(state.doc.toString()).toBe(source);
	});

	it("renders block markers while retaining their source ranges", () => {
		const source = "plain\n\n# Heading\n\n- item\n- [x] task\n\n---";
		const state = previewState(source, 0);
		const decorations = observedDecorations(state);

		expect(decorations.some(({ kind }) => kind === "heading")).toBe(true);
		expect(sourceSlices(state, decorations, "list-marker")).toEqual(["-"]);
		expect(sourceSlices(state, decorations, "task-marker")).toEqual(["[x]"]);
		expect(sourceSlices(state, decorations, "hidden-syntax")).toContain("-");
		expect(sourceSlices(state, decorations, "horizontal-rule")).toEqual(["---"]);
	});

	it("collapses inactive fenced-code marker lines", () => {
		const source = "plain\n\n```ts\nconst value = 1;\n```";
		const state = previewState(source, 0);

		expect(
			observedDecorations(state).filter(({ kind }) => kind === "hidden-code-fence-line"),
		).toHaveLength(2);
	});

	it("bounds decoration work to the requested viewport", () => {
		const visibleSource = "**visible near the start**\n";
		const maximumAsciiDocumentSize = 16 * 1024 * 1024;
		const source = visibleSource + "x".repeat(maximumAsciiDocumentSize - visibleSource.length);
		const viewportEnd = visibleSource.length;
		const state = previewState(source, source.length);
		const decorations = observedDecorations(state, 0, viewportEnd);

		expect(decorations.length).toBeLessThan(20);
		expect(decorations.every(({ from }) => from <= viewportEnd)).toBe(true);
	});
});
