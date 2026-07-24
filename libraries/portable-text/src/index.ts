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
		_type: Type.String({ pattern: "^(?!span$).+" }),
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

export const PortableTextCustomBlock = Type.Object(
	{
		_key: Type.String(),
		_type: Type.String({ pattern: "^(?!(?:block|image)$).+" }),
	},
	{ additionalProperties: JsonValue },
);
export type PortableTextCustomBlock = Static<typeof PortableTextCustomBlock> &
	Record<string, JsonValue>;

export const PortableTextImage = Type.Object(
	{
		_key: Type.String(),
		_type: Type.Literal("image"),
		assetId: Type.String({
			pattern:
				"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
		}),
		alt: Type.Optional(Type.String()),
		caption: Type.Optional(Type.String()),
	},
	{ additionalProperties: false, $id: "PortableTextImage" },
);
export type PortableTextImageBlock = Static<typeof PortableTextImage>;

export const PortableTextBlock = Type.Union(
	[PortableTextTextBlock, PortableTextImage, PortableTextCustomBlock],
	{
		$id: "PortableTextBlock",
	},
);
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

/**
 * The Portable Text vocabulary supported by REZICS.
 *
 * Portable Text explicitly allows custom block objects beside text blocks. The
 * owning host decides which custom `_type` values are valid; this package keeps
 * those JSON-safe values lossless instead of coupling the format to a host.
 */
export type PortableTextValue = (
	PortableTextValueBlock | PortableTextImageBlock | PortableTextCustomBlock
)[];

export function isPortableTextValueBlock(
	value: PortableTextValue[number],
): value is PortableTextValueBlock {
	return value._type === "block" && Array.isArray(value.children);
}

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

function isJsonValue(value: unknown): value is JsonValue {
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	)
		return true;
	if (Array.isArray(value)) return value.every(isJsonValue);
	if (!isRecord(value)) return false;
	return Object.values(value).every(isJsonValue);
}

function normalizeCustomBlock(
	candidate: Record<string, unknown>,
	blockIndex: number,
): PortableTextCustomBlock | null {
	if (
		typeof candidate._type !== "string" ||
		candidate._type === "block" ||
		candidate._type === "image"
	)
		return null;
	const entries = Object.entries(candidate).filter(([, value]) => isJsonValue(value));
	const normalized = Object.fromEntries(entries) as Record<string, JsonValue>;
	return {
		...normalized,
		_key: keyOr(candidate._key, `custom-${blockIndex}`),
		_type: candidate._type,
	};
}

/**
 * Narrows arbitrary API/editor data to the Portable Text vocabulary understood
 * by the product. Root custom objects are preserved for the owning block host to
 * validate and render.
 */
export function normalizePortableText(value: unknown): PortableTextValue {
	if (!Array.isArray(value)) return [];

	return value.flatMap((candidate, blockIndex): PortableTextValue => {
		if (
			isRecord(candidate) &&
			candidate._type === "image" &&
			typeof candidate.assetId === "string" &&
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
				candidate.assetId,
			)
		) {
			return [
				{
					_key: keyOr(candidate._key, `image-${blockIndex}`),
					_type: "image",
					assetId: candidate.assetId,
					...(typeof candidate.alt === "string" ? { alt: candidate.alt } : {}),
					...(typeof candidate.caption === "string"
						? { caption: candidate.caption }
						: {}),
				},
			];
		}
		if (!isRecord(candidate)) return [];
		if (candidate._type !== "block") {
			const customBlock = normalizeCustomBlock(candidate, blockIndex);
			return customBlock ? [customBlock] : [];
		}

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

export {
	measurePortableText,
	PortableTextMetricAlgorithmVersion,
	portableTextMetricText,
	type PortableTextMetrics,
} from "./metrics";
