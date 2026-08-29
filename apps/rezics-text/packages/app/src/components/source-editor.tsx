import { rezicsMarkdown, rezicsMarkdownLivePreview } from "@rezics/editor/markdown";
import {
	CodeEditor,
	EditorView,
	type CodeEditorHandle,
	type Extension,
} from "@rezics/editor/codemirror";
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	type ReactElement,
} from "react";
import type { RezicsTextMessages } from "../i18n/messages";
import type { MarkdownEditingMode } from "../domain/workspace-state";

export interface MarkdownEditorCursor {
	readonly line: number;
	readonly column: number;
}

export interface MarkdownEditorHandle {
	readonly focus: () => void;
	readonly revealOffset: (offset: number) => void;
}

const sourceExtensions: readonly Extension[] = [rezicsMarkdown(), EditorView.lineWrapping];
const previewExtensions: readonly Extension[] = [
	rezicsMarkdown(),
	rezicsMarkdownLivePreview(),
	EditorView.lineWrapping,
];

function cursorFromView(view: EditorView): MarkdownEditorCursor {
	const head = view.state.selection.main.head;
	const line = view.state.doc.lineAt(head);
	return { line: line.number, column: head - line.from + 1 };
}

export const MarkdownEditor = forwardRef<
	MarkdownEditorHandle,
	{
		readonly documentId: string;
		readonly value: string;
		readonly onChange: (value: string) => void;
		readonly onCursorChange: (cursor: MarkdownEditorCursor) => void;
		readonly messages: RezicsTextMessages;
		readonly mode: MarkdownEditingMode;
		readonly readOnly?: boolean;
	}
>(function MarkdownEditor(
	{ documentId, value, onChange, onCursorChange, messages, mode, readOnly = false },
	forwardedRef,
): ReactElement {
	const editorRef = useRef<CodeEditorHandle>(null);
	const onCursorChangeRef = useRef(onCursorChange);
	onCursorChangeRef.current = onCursorChange;

	const extensions = useMemo((): readonly Extension[] => {
		const cursor = EditorView.updateListener.of((update) => {
			if (!update.selectionSet && !update.docChanged) return;
			onCursorChangeRef.current(cursorFromView(update.view));
		});
		return mode === "preview" ? [...previewExtensions, cursor] : [...sourceExtensions, cursor];
	}, [mode]);

	useImperativeHandle(
		forwardedRef,
		() => ({
			focus: () => editorRef.current?.focus(),
			revealOffset: (offset: number) => {
				const view = editorRef.current?.getView();
				if (!view) return;
				const max = view.state.doc.length;
				const position = offset < 0 ? 0 : offset > max ? max : offset;
				view.dispatch({
					selection: { anchor: position },
					scrollIntoView: true,
				});
				view.focus();
			},
		}),
		[],
	);

	useEffect(() => {
		const view = editorRef.current?.getView();
		if (!view) return;
		view.dispatch({ selection: { anchor: 0 }, scrollIntoView: false });
		onCursorChangeRef.current(cursorFromView(view));
	}, [documentId]);

	return (
		<CodeEditor
			ariaLabel={
				mode === "preview" ? messages.labels.livePreviewEditor : messages.labels.sourceEditor
			}
			className={
				mode === "preview"
					? "rezics-markdown-live-preview min-h-0 flex-1 [&_.cm-editor]:h-full"
					: "rezics-markdown-source min-h-0 flex-1 [&_.cm-editor]:h-full"
			}
			extensions={extensions}
			onChange={onChange}
			placeholder={messages.labels.editorPlaceholder}
			ref={editorRef}
			readOnly={readOnly}
			value={value}
		/>
	);
});
