import { type Static, Type } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";

export const JsonValue = Type.Recursive(
	(JsonValue) =>
		Type.Union([
			Type.Null(),
			Type.Boolean(),
			Type.Number(),
			Type.String(),
			Type.Array(JsonValue),
			Type.Record(Type.String(), JsonValue),
		]),
	{ $id: "#/components/schemas/JsonValue" },
);
export type JsonValue = Static<typeof JsonValue>;

export const PortableTextObject = Type.Object(
	{
		_key: Type.String(),
		_type: Type.String(),
	},
	{ additionalProperties: JsonValue, $id: "PortableTextObject" },
);
export type PortableTextObject = Static<typeof PortableTextObject> & Record<string, JsonValue>;

export const PortableTextSpan = Type.Object(
	{
		_key: Type.String(),
		_type: Type.Literal("span"),
		text: Type.String(),
		marks: Type.Optional(Type.Array(Type.String())),
	},
	{ additionalProperties: false, $id: "PortableTextSpan" },
);
export type PortableTextSpan = Static<typeof PortableTextSpan>;

const PortableTextInlineObject = Type.Object(
	{
		_key: Type.String(),
		_type: Type.Intersect([Type.String(), Type.Not(Type.Literal("span"))]),
	},
	{ additionalProperties: JsonValue },
);

export const PortableTextChild = Type.Union([PortableTextSpan, PortableTextInlineObject], {
	$id: "PortableTextChild",
});
export type PortableTextChild = Static<typeof PortableTextChild>;

export const PortableTextTextBlock = Type.Object(
	{
		_key: Type.String(),
		_type: Type.Literal("block"),
		children: Type.Array(PortableTextChild),
		markDefs: Type.Optional(Type.Array(PortableTextObject)),
		listItem: Type.Optional(Type.String()),
		style: Type.Optional(Type.String()),
		level: Type.Optional(Type.Integer({ minimum: 1 })),
	},
	{ additionalProperties: JsonValue, $id: "PortableTextTextBlock" },
);
export type PortableTextTextBlock = Static<typeof PortableTextTextBlock> &
	Record<string, JsonValue>;

const PortableTextCustomBlock = Type.Object(
	{
		_key: Type.String(),
		_type: Type.Intersect([Type.String(), Type.Not(Type.Literal("block"))]),
	},
	{ additionalProperties: JsonValue },
);

export const PortableTextBlock = Type.Union([PortableTextTextBlock, PortableTextCustomBlock], {
	$id: "PortableTextBlock",
});
export type PortableTextBlock = Static<typeof PortableTextBlock>;

export const PortableText = Type.Array(PortableTextBlock, {
	$id: "PortableText",
});
export type PortableText = Static<typeof PortableText>;

export function isPortableText(value: unknown): value is PortableText {
	return Check(PortableText, value);
}

export const PortableTextStyles = ["normal", "h2", "h3", "blockquote"] as const;
export const PortableTextDecorators = ["strong", "em"] as const;
export const PortableTextLists = ["bullet", "number"] as const;

export type PortableTextStyle = (typeof PortableTextStyles)[number];
export type PortableTextDecorator = (typeof PortableTextDecorators)[number];
export type PortableTextList = (typeof PortableTextLists)[number];

export interface PortableTextLinkDefinition {
	[key: string]: unknown;
	_key: string;
	_type: "link";
	href: string;
	openInNewTab?: boolean;
}

export interface PortableTextValueSpan {
	[key: string]: unknown;
	_key: string;
	_type: "span";
	text: string;
	marks: string[];
}

export interface PortableTextValueBlock {
	[key: string]: unknown;
	_key: string;
	_type: "block";
	children: PortableTextValueSpan[];
	markDefs: PortableTextLinkDefinition[];
	style: PortableTextStyle;
	listItem?: PortableTextList;
	level?: number;
}

/** The Portable Text vocabulary supported by every REZICS editor and renderer. */
export type PortableTextValue = PortableTextValueBlock[];

const controlCharacters = /[\u0000-\u001f\u007f]/;
const absoluteScheme = /^([a-z][a-z\d+.-]*):/i;
const safeSchemes = new Set(["http", "https", "mailto"]);

/**
 * Returns a canonical, render-safe link or `null` when the value uses an
 * unsupported URL form. Relative links, anchors, and query strings are kept.
 */
export function normalizePortableTextUrl(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const href = value.trim();
	if (!href || controlCharacters.test(href) || href.startsWith("//")) return null;

	const scheme = absoluteScheme.exec(href)?.[1]?.toLowerCase();
	if (scheme && !safeSchemes.has(scheme)) return null;
	if (!scheme && href.startsWith("\\")) return null;

	return href;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function memberOf<const Values extends readonly string[]>(
	values: Values,
	value: unknown,
): value is Values[number] {
	return typeof value === "string" && values.some((candidate) => candidate === value);
}

function keyOr(value: unknown, fallback: string): string {
	return typeof value === "string" && value.length > 0 ? value : fallback;
}

/**
 * Narrows arbitrary API/editor data to the single Portable Text vocabulary
 * understood by the product. Unsupported objects and marks are intentionally
 * omitted instead of leaking inconsistent rendering rules into feature code.
 */
export function normalizePortableText(value: unknown): PortableTextValue {
	if (!Array.isArray(value)) return [];

	return value.flatMap((candidate, blockIndex): PortableTextValueBlock[] => {
		if (!isRecord(candidate) || candidate._type !== "block") return [];

		const markDefs = Array.isArray(candidate.markDefs)
			? candidate.markDefs.flatMap(
					(definition, definitionIndex): PortableTextLinkDefinition[] => {
						if (!isRecord(definition) || definition._type !== "link") return [];
						const href = normalizePortableTextUrl(definition.href);
						if (!href) return [];
						return [
							{
								_key: keyOr(
									definition._key,
									`link-${blockIndex}-${definitionIndex}`,
								),
								_type: "link",
								href,
								...(typeof definition.openInNewTab === "boolean"
									? { openInNewTab: definition.openInNewTab }
									: {}),
							},
						];
					},
				)
			: [];
		const annotationKeys = new Set(markDefs.map(({ _key }) => _key));
		const children = Array.isArray(candidate.children)
			? candidate.children.flatMap((child, childIndex): PortableTextValueSpan[] => {
					if (
						!isRecord(child) ||
						child._type !== "span" ||
						typeof child.text !== "string"
					) {
						return [];
					}
					const marks = Array.isArray(child.marks)
						? child.marks.filter(
								(mark): mark is string =>
									typeof mark === "string" &&
									(memberOf(PortableTextDecorators, mark) ||
										annotationKeys.has(mark)),
							)
						: [];
					return [
						{
							_key: keyOr(child._key, `span-${blockIndex}-${childIndex}`),
							_type: "span",
							text: child.text,
							marks,
						},
					];
				})
			: [];
		const listItem = memberOf(PortableTextLists, candidate.listItem)
			? candidate.listItem
			: undefined;
		const level =
			listItem && Number.isInteger(candidate.level) && Number(candidate.level) >= 1
				? Number(candidate.level)
				: undefined;

		return [
			{
				_key: keyOr(candidate._key, `block-${blockIndex}`),
				_type: "block",
				children,
				markDefs,
				style: memberOf(PortableTextStyles, candidate.style) ? candidate.style : "normal",
				...(listItem ? { listItem } : {}),
				...(level ? { level } : {}),
			},
		];
	});
}
