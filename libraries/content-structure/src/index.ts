import {
	JsonValue,
	type PortableText as PortableTextValue,
	PortableText,
} from "@rezics/portable-text";
import { type Static, type TSchema, Type } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";

/**
 * Block keys are document-local identities. Six random bytes keep stored
 * documents compact while avoiding positional identities that break on edit.
 */
export const BlockKey = Type.String({
	pattern: "^[0-9a-f]{12}$",
	$id: "BlockKey",
});
export type BlockKey = Static<typeof BlockKey>;

/**
 * Portable Text is a content format carried by Content Structure. It is not a
 * database column type and must always cross persistence in this envelope.
 */
export const PortableTextDocument = Type.Object(
	{
		_type: Type.Literal("portable-text"),
		_key: BlockKey,
		content: PortableText,
	},
	{
		additionalProperties: false,
		$id: "PortableTextDocument",
	},
);
export type PortableTextDocument = Static<typeof PortableTextDocument>;

export const ZoneBoundaryDocument = Type.Object(
	{
		_type: Type.Literal("zone-boundary"),
		_key: BlockKey,
		definition: JsonValue,
	},
	{
		additionalProperties: false,
		$id: "ZoneBoundaryDocument",
	},
);
export type ZoneBoundaryDocument = Static<typeof ZoneBoundaryDocument>;

export const ZoneThemeDocument = Type.Object(
	{
		_type: Type.Literal("zone-theme"),
		_key: BlockKey,
		tokens: JsonValue,
	},
	{
		additionalProperties: false,
		$id: "ZoneThemeDocument",
	},
);
export type ZoneThemeDocument = Static<typeof ZoneThemeDocument>;

export const PollOptionLocalization = Type.Object(
	{
		optionId: Type.String({ format: "uuid" }),
		label: Type.String({ minLength: 1, maxLength: 500 }),
	},
	{ additionalProperties: false },
);
export type PollOptionLocalization = Static<typeof PollOptionLocalization>;

export const PollContentDocument = Type.Object(
	{
		_type: Type.Literal("poll-content"),
		_key: BlockKey,
		options: Type.Array(PollOptionLocalization, { minItems: 2, maxItems: 50 }),
	},
	{ additionalProperties: false, $id: "PollContentDocument" },
);
export type PollContentDocument = Static<typeof PollContentDocument>;

export const CollectionDefinitionDocument = Type.Union(
	[
		Type.Object(
			{
				_type: Type.Literal("collection-definition"),
				_key: BlockKey,
				source: Type.Literal("manual"),
			},
			{ additionalProperties: false },
		),
		Type.Object(
			{
				_type: Type.Literal("collection-definition"),
				_key: BlockKey,
				source: Type.Literal("dynamic"),
				query: Type.Record(Type.String(), Type.Unknown()),
			},
			{ additionalProperties: false },
		),
		Type.Object(
			{
				_type: Type.Literal("collection-definition"),
				_key: BlockKey,
				source: Type.Literal("system"),
				systemKey: Type.Literal("favorites"),
			},
			{ additionalProperties: false },
		),
	],
	{ $id: "CollectionDefinitionDocument" },
);
export type CollectionDefinitionDocument = Static<typeof CollectionDefinitionDocument>;

export const CollectionPresentationDocument = Type.Object(
	{
		_type: Type.Literal("collection-presentation"),
		_key: BlockKey,
		layout: Type.Union([Type.Literal("flat"), Type.Literal("nested"), Type.Literal("shelf")]),
		order: Type.Union([Type.Literal("manual"), Type.Literal("name"), Type.Literal("added-at")]),
	},
	{
		additionalProperties: false,
		$id: "CollectionPresentationDocument",
	},
);
export type CollectionPresentationDocument = Static<typeof CollectionPresentationDocument>;

export function createBlockKey(): BlockKey {
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createPortableTextDocument(
	content: PortableTextValue,
	key: BlockKey = createBlockKey(),
): PortableTextDocument {
	return {
		_type: "portable-text",
		_key: key,
		content,
	};
}

export function updatePortableTextDocument(
	document: PortableTextDocument,
	content: PortableTextValue,
): PortableTextDocument {
	return { ...document, content };
}

export function isPortableTextDocument(value: unknown): value is PortableTextDocument {
	return Check(PortableTextDocument, value);
}

export function getPortableTextContent(value: unknown): PortableTextValue {
	assertDocument(PortableTextDocument, value);
	return value.content;
}

export function createZoneBoundaryDocument(
	definition: JsonValue,
	key: BlockKey = createBlockKey(),
): ZoneBoundaryDocument {
	return { _type: "zone-boundary", _key: key, definition };
}

export function createZoneThemeDocument(
	tokens: JsonValue,
	key: BlockKey = createBlockKey(),
): ZoneThemeDocument {
	return { _type: "zone-theme", _key: key, tokens };
}

export function createPollContentDocument(
	options: PollOptionLocalization[],
	key: BlockKey = createBlockKey(),
): PollContentDocument {
	return { _type: "poll-content", _key: key, options };
}

export function createManualCollectionDefinitionDocument(
	key: BlockKey = createBlockKey(),
): CollectionDefinitionDocument {
	return { _type: "collection-definition", _key: key, source: "manual" };
}

export function createSystemCollectionDefinitionDocument(
	systemKey: "favorites",
	key: BlockKey = createBlockKey(),
): CollectionDefinitionDocument {
	return {
		_type: "collection-definition",
		_key: key,
		source: "system",
		systemKey,
	};
}

export function createCollectionPresentationDocument(
	layout: CollectionPresentationDocument["layout"] = "flat",
	order: CollectionPresentationDocument["order"] = "manual",
	key: BlockKey = createBlockKey(),
): CollectionPresentationDocument {
	return {
		_type: "collection-presentation",
		_key: key,
		layout,
		order,
	};
}

export function isDocument<TSchemaValue extends TSchema>(
	schema: TSchemaValue,
	value: unknown,
): value is Static<TSchemaValue> {
	return Check(schema, value);
}

export function assertDocument<TSchemaValue extends TSchema>(
	schema: TSchemaValue,
	value: unknown,
): asserts value is Static<TSchemaValue> {
	if (!Check(schema, value)) {
		throw new TypeError("Invalid Content Structure document");
	}
}

export function parseDocument<TSchemaValue extends TSchema>(
	schema: TSchemaValue,
	value: unknown,
): Static<TSchemaValue> {
	assertDocument(schema, value);
	return value;
}

export function parseNullableDocument<TSchemaValue extends TSchema>(
	schema: TSchemaValue,
	value: unknown,
): Static<TSchemaValue> | null {
	return value === null ? null : parseDocument(schema, value);
}
