import {
	EditorProvider,
	PortableTextEditable,
	useEditor,
	type Editor,
	type EditorEmittedEvent,
	type PortableTextBlock,
	type PortableTextEditableProps,
	type SchemaDefinition,
} from "@portabletext/editor";
import { EditorRefPlugin, EventListenerPlugin } from "@portabletext/editor/plugins";
import {
	useCallback,
	useEffect,
	useRef,
	type MutableRefObject,
	type ReactElement,
	type Ref,
} from "react";

type EditableProps = Omit<
	PortableTextEditableProps,
	"selection" | "value" | "onChange" | "readOnly"
>;

/** @alpha */
export interface PortableTextEditorProps extends EditableProps {
	readonly value: Array<PortableTextBlock>;
	/** Changes force the upstream editor to re-evaluate the controlled value, even when its identity is unchanged. */
	readonly valueRevision?: string | number;
	readonly onChange: (value: Array<PortableTextBlock>) => void;
	readonly schemaDefinition: SchemaDefinition;
	readonly editorRef?: Ref<Editor | null>;
	readonly readOnly?: boolean;
	readonly onEditorEvent?: (event: EditorEmittedEvent) => void;
}

function ControlledValuePlugin({
	value,
	valueRevision,
	readOnly,
	lastMutationValueRef,
}: {
	readonly value: Array<PortableTextBlock>;
	readonly valueRevision: string | number | undefined;
	readonly readOnly: boolean;
	readonly lastMutationValueRef: MutableRefObject<Array<PortableTextBlock> | null>;
}) {
	const editor = useEditor();

	useEffect(() => {
		if (value === lastMutationValueRef.current) return;
		lastMutationValueRef.current = value;
		editor.send({ type: "update value", value });
	}, [editor, lastMutationValueRef, value, valueRevision]);

	useEffect(() => {
		editor.send({ type: "update readOnly", readOnly });
	}, [editor, readOnly]);

	return null;
}

/**
 * A controlled, schema-driven Portable Text editing surface with no product UI dependency.
 *
 * @alpha
 */
export function PortableTextEditor({
	value,
	valueRevision,
	onChange,
	schemaDefinition,
	editorRef,
	readOnly = false,
	onEditorEvent,
	...editableProps
}: PortableTextEditorProps): ReactElement {
	const lastMutationValueRef = useRef<Array<PortableTextBlock> | null>(value);
	const onChangeRef = useRef(onChange);
	const onEditorEventRef = useRef(onEditorEvent);
	onChangeRef.current = onChange;
	onEditorEventRef.current = onEditorEvent;
	const handleEditorEvent = useCallback((event: EditorEmittedEvent) => {
		onEditorEventRef.current?.(event);
		if (event.type !== "mutation") return;
		const nextValue = event.value ?? [];
		lastMutationValueRef.current = nextValue;
		onChangeRef.current(nextValue);
	}, []);

	return (
		<EditorProvider initialConfig={{ schemaDefinition, initialValue: value, readOnly }}>
			<ControlledValuePlugin
				lastMutationValueRef={lastMutationValueRef}
				readOnly={readOnly}
				value={value}
				valueRevision={valueRevision}
			/>
			<EditorRefPlugin ref={editorRef} />
			<EventListenerPlugin on={handleEditorEvent} />
			<PortableTextEditable {...editableProps} />
		</EditorProvider>
	);
}
