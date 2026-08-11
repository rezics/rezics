import { EditorSelection, type ChangeSpec } from "@codemirror/state";
import { keymap, type Command, type KeyBinding } from "@codemirror/view";

function toggleSurround(open: string, close: string, placeholder: string): Command {
	return (view) => {
		const transaction = view.state.changeByRange((range) => {
			const selected = view.state.sliceDoc(range.from, range.to);
			if (selected.length === 0) {
				const inserted = `${open}${placeholder}${close}`;
				return {
					changes: { from: range.from, insert: inserted },
					range: EditorSelection.range(
						range.from + open.length,
						range.from + open.length + placeholder.length,
					),
				};
			}

			const isWrapped = selected.startsWith(open) && selected.endsWith(close);
			if (isWrapped) {
				const inner = selected.slice(open.length, selected.length - close.length);
				return {
					changes: { from: range.from, to: range.to, insert: inner },
					range: EditorSelection.range(range.from, range.from + inner.length),
				};
			}

			const inserted = `${open}${selected}${close}`;
			return {
				changes: { from: range.from, to: range.to, insert: inserted },
				range: EditorSelection.range(range.from + open.length, range.to + open.length),
			};
		});

		view.dispatch(transaction);
		return true;
	};
}

function selectedLineNumbers(view: Parameters<Command>[0]): readonly number[] {
	const lineNumbers = new Set<number>();
	for (const range of view.state.selection.ranges) {
		const first = view.state.doc.lineAt(range.from).number;
		const lastPosition = range.to > range.from ? range.to - 1 : range.to;
		const last = view.state.doc.lineAt(lastPosition).number;
		for (let line = first; line <= last; line += 1) lineNumbers.add(line);
	}
	return [...lineNumbers].sort((left, right) => left - right);
}

function toggleLinePrefix(prefix: string): Command {
	return (view) => {
		const lines = selectedLineNumbers(view).map((number) => view.state.doc.line(number));
		const allPrefixed = lines.every((line) => line.text.startsWith(prefix));
		const changes: ChangeSpec[] = [];
		for (const line of lines) {
			if (allPrefixed) changes.push({ from: line.from, to: line.from + prefix.length });
			else if (!line.text.startsWith(prefix)) changes.push({ from: line.from, insert: prefix });
		}
		view.dispatch({ changes });
		return true;
	};
}

/** @alpha */
export const toggleMarkdownStrong = toggleSurround("**", "**", "strong text");

/** @alpha */
export const toggleMarkdownEmphasis = toggleSurround("_", "_", "emphasized text");

/** @alpha */
export const toggleMarkdownStrikethrough = toggleSurround("~~", "~~", "struck text");

/** @alpha */
export const toggleMarkdownInlineCode = toggleSurround("`", "`", "code");

/** @alpha */
export const toggleMarkdownBlockquote = toggleLinePrefix("> ");

/** @alpha */
export const toggleMarkdownBulletList = toggleLinePrefix("- ");

/** @alpha */
export const toggleMarkdownNumberedList = toggleLinePrefix("1. ");

/** @alpha */
export const toggleMarkdownTaskList = toggleLinePrefix("- [ ] ");

/** @alpha */
export function setMarkdownHeading(level: 0 | 1 | 2 | 3 | 4 | 5 | 6): Command {
	return (view) => {
		const lines = selectedLineNumbers(view).map((number) => view.state.doc.line(number));
		const headingPattern = /^(#{1,6})\s+/u;
		const targetPrefix = level === 0 ? "" : `${"#".repeat(level)} `;
		const allAtTarget =
			level > 0 && lines.every((line) => line.text.match(headingPattern)?.[1]?.length === level);
		const effectivePrefix = allAtTarget ? "" : targetPrefix;
		const changes: ChangeSpec[] = [];
		for (const line of lines) {
			const existing = line.text.match(headingPattern)?.[0] ?? "";
			if (existing === effectivePrefix) continue;
			changes.push({
				from: line.from,
				to: line.from + existing.length,
				insert: effectivePrefix,
			});
		}
		if (changes.length > 0) view.dispatch({ changes });
		return true;
	};
}

/** @alpha */
export const insertMarkdownLink = toggleSurround("[", "](https://)", "link text");

/** @alpha */
export const insertMarkdownFencedCode = toggleSurround("```\n", "\n```", "code");

/** @alpha */
export function insertMarkdownSnippet(snippet: string): Command {
	return (view) => {
		view.dispatch(
			view.state.changeByRange((range) => ({
				changes: { from: range.from, to: range.to, insert: snippet },
				range: EditorSelection.cursor(range.from + snippet.length),
			})),
		);
		return true;
	};
}

/** @alpha */
export const insertMarkdownImage = insertMarkdownSnippet("![alt text](https://)");

/** @alpha */
export const insertMarkdownTable = insertMarkdownSnippet(
	"| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |",
);

/** @alpha */
export const rezicsMarkdownKeyBindings: readonly KeyBinding[] = [
	{ key: "Mod-b", run: toggleMarkdownStrong },
	{ key: "Mod-i", run: toggleMarkdownEmphasis },
	{ key: "Mod-Shift-x", run: toggleMarkdownStrikethrough },
	{ key: "Mod-`", run: toggleMarkdownInlineCode },
	{ key: "Mod-Shift-.", run: toggleMarkdownBlockquote },
	{ key: "Mod-Shift-7", run: toggleMarkdownNumberedList },
	{ key: "Mod-Shift-8", run: toggleMarkdownBulletList },
];

/** @alpha */
export const rezicsMarkdownKeymap = keymap.of(rezicsMarkdownKeyBindings);
