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
