import type { PortableTextBlock, PortableTextTextBlock } from "@portabletext/editor";
import { isPortableText } from "@rezics/portable-text";

interface EditorWireSpan {
	[key: string]: unknown;
	_key: string;
	_type: "span";
	text: string;
	marks?: string[];
}

interface EditorWireBlock {
	[key: string]: unknown;
	_key: string;
	_type: "block";
	children: EditorWireSpan[];
	markDefs?: { [key: string]: unknown; _key: string; _type: string }[];
	listItem?: string;
	style?: string;
	level?: number;
}

export type EditorWirePortableText = EditorWireBlock[];

function isEditorTextBlock(block: PortableTextBlock): block is PortableTextTextBlock {
	return block._type === "block";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isEditorWirePortableText(value: unknown): value is EditorWirePortableText {
	return (
		isPortableText(value) &&
		value.every(
			(block) =>
				block._type === "block" &&
				"children" in block &&
				Array.isArray(block.children) &&
				block.children.every((child) => child._type === "span"),
		)
	);
}

export function toPortableTextFromEditor(
	value: readonly PortableTextBlock[],
): EditorWirePortableText {
	const wireValue: unknown = value.map((block) =>
		isEditorTextBlock(block)
			? {
					...block,
					children: block.children.map((child) => ({ ...child })),
					markDefs: block.markDefs?.map((definition) => ({ ...definition })),
				}
			: { ...block },
	);
	if (!isEditorWirePortableText(wireValue)) {
		throw new Error("Editor produced unsupported Portable Text");
	}
	return wireValue;
}

export function toPortableTextForReact(value: unknown): EditorWirePortableText {
	return isEditorWirePortableText(value) ? value : [];
}

export function toPortableTextForEditor(value: unknown): PortableTextBlock[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((block): PortableTextTextBlock[] => {
		if (!isRecord(block) || block._type !== "block" || !Array.isArray(block.children)) {
			return [];
		}
		const children = block.children.flatMap((child) =>
			isRecord(child) && child._type === "span" && typeof child.text === "string"
				? [
						{
							_key: typeof child._key === "string" ? child._key : crypto.randomUUID(),
							_type: "span" as const,
							text: child.text,
							marks: Array.isArray(child.marks)
								? child.marks.filter(
										(mark): mark is string => typeof mark === "string",
									)
								: [],
						},
					]
				: [],
		);
		return [
			{
				_key: typeof block._key === "string" ? block._key : crypto.randomUUID(),
				_type: "block",
				children,
				markDefs: Array.isArray(block.markDefs) ? block.markDefs : [],
				style: typeof block.style === "string" ? block.style : "normal",
				...(typeof block.listItem === "string" ? { listItem: block.listItem } : {}),
				...(typeof block.level === "number" ? { level: block.level } : {}),
			},
		];
	});
}
