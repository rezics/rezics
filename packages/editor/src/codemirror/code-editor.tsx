import { Annotation, Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	type CSSProperties,
	type ReactElement,
} from "react";

const externalValueChange = Annotation.define<boolean>();
const emptyExtensions: readonly Extension[] = [];

/** @alpha */
export interface CodeEditorHandle {
	readonly focus: () => void;
	readonly getView: () => EditorView | null;
}

/** @alpha */
export interface CodeEditorProps {
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly ariaLabel: string;
	readonly extensions?: readonly Extension[];
	readonly readOnly?: boolean;
	readonly autoFocus?: boolean;
	readonly className?: string;
	readonly style?: CSSProperties;
}

/**
 * A controlled CodeMirror 6 surface that reconfigures extensions without recreating editor state.
 *
 * @alpha
 */
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
	{
		value,
		onChange,
		ariaLabel,
		extensions = emptyExtensions,
		readOnly = false,
		autoFocus = false,
		className,
		style,
	},
	forwardedRef,
): ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const onChangeRef = useRef(onChange);
	const valueRef = useRef(value);
	const extensionsCompartmentRef = useRef(new Compartment());
	const editableCompartmentRef = useRef(new Compartment());
	const accessibilityCompartmentRef = useRef(new Compartment());

	onChangeRef.current = onChange;
	valueRef.current = value;

	useImperativeHandle(
		forwardedRef,
		() => ({
			focus: () => viewRef.current?.focus(),
			getView: () => viewRef.current,
		}),
		[],
	);

	useEffect(() => {
		const parent = containerRef.current;
		if (!parent) return;

		const view = new EditorView({
			parent,
			state: EditorState.create({
				doc: valueRef.current,
				extensions: [
					basicSetup,
					rezicsCodeEditorTheme,
					extensionsCompartmentRef.current.of(extensions),
					editableCompartmentRef.current.of([
						EditorState.readOnly.of(readOnly),
						EditorView.editable.of(!readOnly),
					]),
					accessibilityCompartmentRef.current.of(
						EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
					),
					EditorView.updateListener.of((update) => {
						if (
							update.docChanged &&
							!update.transactions.some(
								(transaction) =>
									transaction.annotation(externalValueChange) === true,
							)
						) {
							onChangeRef.current(update.state.doc.toString());
						}
					}),
				],
			}),
		});

		viewRef.current = view;
		if (autoFocus) view.focus();

		return () => {
			viewRef.current = null;
			view.destroy();
		};
	}, []);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;
		view.dispatch({
			effects: extensionsCompartmentRef.current.reconfigure(extensions),
		});
	}, [extensions]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;
		view.dispatch({
			effects: editableCompartmentRef.current.reconfigure([
				EditorState.readOnly.of(readOnly),
				EditorView.editable.of(!readOnly),
			]),
		});
	}, [readOnly]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;
		view.dispatch({
			effects: accessibilityCompartmentRef.current.reconfigure(
				EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
			),
		});
	}, [ariaLabel]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view || value === view.state.doc.toString()) return;
		view.dispatch({
			annotations: externalValueChange.of(true),
			changes: { from: 0, to: view.state.doc.length, insert: value },
		});
	}, [value]);

	return (
		<div
			className={className ? `rezics-code-editor ${className}` : "rezics-code-editor"}
			ref={containerRef}
			style={style}
		/>
	);
});

/** @alpha */
export const rezicsCodeEditorTheme = EditorView.theme({
	"&": {
		height: "100%",
		backgroundColor: "transparent",
	},
	".cm-scroller": {
		fontFamily: "var(--rezics-editor-monospace, ui-monospace, SFMono-Regular, monospace)",
		lineHeight: "1.65",
		overflow: "auto",
	},
	".cm-content": {
		caretColor: "currentColor",
		padding: "var(--rezics-editor-padding, 2rem)",
	},
	".cm-gutters": {
		backgroundColor: "transparent",
		border: "none",
	},
	".cm-focused": {
		outline: "none",
	},
});
