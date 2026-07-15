"use client";

import {
	defineSchema,
	EditorProvider,
	PortableTextEditable,
	useEditor,
	type PortableTextBlock,
	type RenderAnnotationFunction,
	type RenderDecoratorFunction,
	type RenderStyleFunction,
} from "@portabletext/editor";
import { EventListenerPlugin } from "@portabletext/editor/plugins";

import { useUiMessages } from "./ui-provider";
import { Button } from "../ui/button";

const schemaDefinition = defineSchema({
	decorators: [{ name: "strong" }, { name: "em" }],
	styles: [{ name: "normal" }, { name: "h2" }, { name: "h3" }, { name: "blockquote" }],
	lists: [{ name: "bullet" }, { name: "number" }],
	annotations: [{ name: "link" }],
	inlineObjects: [],
	blockObjects: [],
});

const renderStyle: RenderStyleFunction = ({ schemaType, children }) =>
	schemaType.value === "h2" ? (
		<h2 className="text-xl font-bold">{children}</h2>
	) : schemaType.value === "h3" ? (
		<h3 className="text-lg font-semibold">{children}</h3>
	) : schemaType.value === "blockquote" ? (
		<blockquote className="border-s-2 ps-4 italic">{children}</blockquote>
	) : (
		<p>{children}</p>
	);

const renderDecorator: RenderDecoratorFunction = ({ value, children }) =>
	value === "strong" ? (
		<strong>{children}</strong>
	) : value === "em" ? (
		<em>{children}</em>
	) : (
		<>{children}</>
	);

const renderAnnotation: RenderAnnotationFunction = ({ value, children }) => {
	const href = typeof value.href === "string" ? value.href : undefined;
	return href ? (
		<a className="text-primary underline" href={href} rel="noreferrer">
			{children}
		</a>
	) : (
		<>{children}</>
	);
};

function Toolbar() {
	const editor = useEditor();
	const { editor: labels } = useUiMessages();
	const styleLabels = {
		normal: labels.paragraph,
		h2: labels.heading2,
		h3: labels.heading3,
		blockquote: labels.quote,
	};
	const decoratorLabels = { strong: labels.bold, em: labels.italic };
	const listLabels = { bullet: labels.bulletList, number: labels.numberedList };

	return (
		<div className="flex flex-wrap gap-1 border-b p-2">
			{schemaDefinition.styles.map((style) => (
				<Button
					key={style.name}
					onClick={() => {
						editor.send({ type: "style.toggle", style: style.name });
						editor.send({ type: "focus" });
					}}
					size="xs"
					type="button"
					variant="ghost"
				>
					{styleLabels[style.name as keyof typeof styleLabels]}
				</Button>
			))}
			{schemaDefinition.decorators.map((decorator) => (
				<Button
					key={decorator.name}
					onClick={() => {
						editor.send({ type: "decorator.toggle", decorator: decorator.name });
						editor.send({ type: "focus" });
					}}
					size="xs"
					type="button"
					variant="ghost"
				>
					{decoratorLabels[decorator.name as keyof typeof decoratorLabels]}
				</Button>
			))}
			{schemaDefinition.lists.map((list) => (
				<Button
					key={list.name}
					onClick={() => {
						editor.send({ type: "list item.toggle", listItem: list.name });
						editor.send({ type: "focus" });
					}}
					size="xs"
					type="button"
					variant="ghost"
				>
					{listLabels[list.name as keyof typeof listLabels]}
				</Button>
			))}
			<Button
				onClick={() => {
					const href = window.prompt(labels.linkPrompt);
					if (href)
						editor.send({
							type: "annotation.toggle",
							annotation: { name: "link", value: { href } },
						});
					editor.send({ type: "focus" });
				}}
				size="xs"
				type="button"
				variant="ghost"
			>
				{labels.link}
			</Button>
		</div>
	);
}

export function PortableTextEditor({
	value,
	onChange,
}: {
	value: PortableTextBlock[];
	onChange: (value: PortableTextBlock[]) => void;
}) {
	return (
		<div className="overflow-hidden rounded-xl border">
			<EditorProvider initialConfig={{ schemaDefinition, initialValue: value }}>
				<EventListenerPlugin
					on={(event) => {
						if (event.type === "mutation") onChange(event.value ?? []);
					}}
				/>
				<Toolbar />
				<PortableTextEditable
					className="min-h-48 p-4 outline-none"
					renderAnnotation={renderAnnotation}
					renderBlock={(props) => <div>{props.children}</div>}
					renderDecorator={renderDecorator}
					renderListItem={(props) => <>{props.children}</>}
					renderStyle={renderStyle}
				/>
			</EditorProvider>
		</div>
	);
}
