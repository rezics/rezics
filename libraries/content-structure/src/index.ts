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

export const PostReferenceBlock = Type.Object(
	{
		_type: Type.Literal("post-ref"),
		_key: BlockKey,
		postId: Type.String({ format: "uuid" }),
	},
	{
		additionalProperties: false,
		$id: "PostReferenceBlock",
	},
);
export type PostReferenceBlock = Static<typeof PostReferenceBlock>;

export const LocalizedLabel = Type.Record(Type.String({ minLength: 1 }), Type.String(), {
	$id: "LocalizedLabel",
});
export type LocalizedLabel = Static<typeof LocalizedLabel>;

export const MenuItemTarget = Type.Union(
	[
		Type.Object(
			{
				type: Type.Literal("href"),
				href: Type.String({ minLength: 1 }),
			},
			{ additionalProperties: false },
		),
		Type.Object(
			{
				type: Type.Literal("unit"),
				unitId: Type.String({ format: "uuid" }),
			},
			{ additionalProperties: false },
		),
		Type.Object(
			{
				type: Type.Literal("page"),
				pageId: Type.String({ format: "uuid" }),
			},
			{ additionalProperties: false },
		),
	],
	{ $id: "MenuItemTarget" },
);
export type MenuItemTarget = Static<typeof MenuItemTarget>;

export const MenuItem = Type.Object(
	{
		_type: Type.Literal("menu-item"),
		_key: BlockKey,
		label: LocalizedLabel,
		target: MenuItemTarget,
	},
	{
		additionalProperties: false,
		$id: "MenuItem",
	},
);
export type MenuItem = Static<typeof MenuItem>;

export const MenuBlock = Type.Object(
	{
		_type: Type.Literal("menu"),
		_key: BlockKey,
		label: Type.Optional(LocalizedLabel),
		items: Type.Array(MenuItem),
	},
	{
		additionalProperties: false,
		$id: "MenuBlock",
	},
);
export type MenuBlock = Static<typeof MenuBlock>;

export const Block = Type.Union([PortableTextDocument, PostReferenceBlock, MenuBlock], {
	$id: "Block",
});
export type Block = Static<typeof Block>;

function createBlockDocument<const TType extends string>(type: TType) {
	return Type.Object(
		{
			_type: Type.Literal(type),
			_key: BlockKey,
			blocks: Type.Array(Block),
		},
		{ additionalProperties: false },
	);
}

export const ContentStructureDocument = Type.Object(
	{
		_type: Type.Literal("content-structure"),
		_key: BlockKey,
		blocks: Type.Array(Block),
	},
	{
		additionalProperties: false,
		$id: "ContentStructureDocument",
	},
);
export type ContentStructureDocument = Static<typeof ContentStructureDocument>;

export const DockDocument = createBlockDocument("dock");
export type DockDocument = Static<typeof DockDocument>;

export const RealmDockDocument = DockDocument;
export type RealmDockDocument = DockDocument;

const ZoneConfiguration = Type.Record(Type.String(), Type.Unknown());

export const ZonePageDocument = Type.Object(
	{
		_type: Type.Literal("zone-page"),
		_key: BlockKey,
		blocks: Type.Array(Block),
		configuration: Type.Optional(ZoneConfiguration),
	},
	{
		additionalProperties: false,
		$id: "ZonePageDocument",
	},
);
export type ZonePageDocument = Static<typeof ZonePageDocument>;

export const ZoneMenuDocument = Type.Object(
	{
		_type: Type.Literal("zone-menu"),
		_key: BlockKey,
		menus: Type.Array(MenuBlock),
		configuration: Type.Optional(ZoneConfiguration),
	},
	{
		additionalProperties: false,
		$id: "ZoneMenuDocument",
	},
);
export type ZoneMenuDocument = Static<typeof ZoneMenuDocument>;

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

export function createDockDocument(
	blocks: Block[] = [],
	key: BlockKey = createBlockKey(),
): DockDocument {
	return { _type: "dock", _key: key, blocks };
}

export function createZonePageDocument(
	blocks: Block[] = [],
	key: BlockKey = createBlockKey(),
	configuration?: Record<string, unknown>,
): ZonePageDocument {
	return configuration === undefined
		? { _type: "zone-page", _key: key, blocks }
		: { _type: "zone-page", _key: key, blocks, configuration };
}

export function createZoneMenuDocument(
	menus: MenuBlock[] = [],
	key: BlockKey = createBlockKey(),
	configuration?: Record<string, unknown>,
): ZoneMenuDocument {
	return configuration === undefined
		? { _type: "zone-menu", _key: key, menus }
		: { _type: "zone-menu", _key: key, menus, configuration };
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
