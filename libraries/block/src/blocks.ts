import { type PortableText as PortableTextValue, PortableText } from "@rezics/portable-text";
import { SearchConfiguration } from "@rezics/search";
import { type Static, type TSchema, Type } from "@sinclair/typebox";

import { BlockKey, createBlockKey } from "./identity";

const Uuid = Type.String({
	pattern:
		"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
});

export const PortableTextDocument = Type.Object(
	{
		_type: Type.Literal("portable-text"),
		_key: BlockKey,
		content: PortableText,
	},
	{ additionalProperties: false, $id: "PortableTextDocument" },
);
export type PortableTextDocument = Static<typeof PortableTextDocument>;

export const UnitRefBlock = Type.Object(
	{
		_type: Type.Literal("unit-ref"),
		_key: BlockKey,
		unitId: Uuid,
		appearance: Type.Union([
			Type.Literal("inline"),
			Type.Literal("card"),
			Type.Literal("cover"),
			Type.Literal("hero"),
		]),
	},
	{ additionalProperties: false, $id: "UnitRefBlock" },
);
export type UnitRefBlock = Static<typeof UnitRefBlock>;

const UnitListSource = Type.Union([
	Type.Object(
		{
			kind: Type.Literal("units"),
			unitIds: Type.Array(Uuid, { minItems: 1, maxItems: 100 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{ kind: Type.Literal("collection"), collectionId: Uuid },
		{ additionalProperties: false },
	),
	Type.Object(
		{ kind: Type.Literal("search"), configuration: SearchConfiguration },
		{ additionalProperties: false },
	),
]);

export const UnitListBlock = Type.Object(
	{
		_type: Type.Literal("unit-list"),
		_key: BlockKey,
		source: UnitListSource,
		layout: Type.Union([Type.Literal("list"), Type.Literal("grid"), Type.Literal("carousel")]),
		limit: Type.Integer({ minimum: 1, maximum: 100 }),
	},
	{ additionalProperties: false, $id: "UnitListBlock" },
);
export type UnitListBlock = Static<typeof UnitListBlock>;

export const SearchBlock = Type.Object(
	{
		_type: Type.Literal("search"),
		_key: BlockKey,
		/** Trusted Search feature configuration, never an engine query. */
		configuration: SearchConfiguration,
		presentation: Type.Object(
			{
				results: Type.Union([
					Type.Literal("list"),
					Type.Literal("grid"),
					Type.Literal("compact"),
				]),
				showResultCount: Type.Boolean(),
			},
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false, $id: "SearchBlock" },
);
export type SearchBlock = Static<typeof SearchBlock>;

export const NavigationTarget = Type.Union([
	Type.Object({ kind: Type.Literal("unit"), unitId: Uuid }, { additionalProperties: false }),
	Type.Object(
		{
			kind: Type.Literal("zone-page"),
			slug: Type.String({
				minLength: 1,
				maxLength: 100,
				pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
			}),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			kind: Type.Literal("external"),
			url: Type.String({ minLength: 1, maxLength: 2_000, pattern: "^https://" }),
		},
		{ additionalProperties: false },
	),
]);
export type NavigationTarget = Static<typeof NavigationTarget>;

export const MenuBlock = Type.Object(
	{
		_type: Type.Literal("menu"),
		_key: BlockKey,
		navigationId: Uuid,
		orientation: Type.Union([Type.Literal("horizontal"), Type.Literal("vertical")]),
		appearance: Type.Union([
			Type.Literal("links"),
			Type.Literal("buttons"),
			Type.Literal("tabs"),
			Type.Literal("drawer"),
		]),
	},
	{ additionalProperties: false, $id: "MenuBlock" },
);
export type MenuBlock = Static<typeof MenuBlock>;

export const MediaBlock = Type.Object(
	{
		_type: Type.Literal("media"),
		_key: BlockKey,
		assetId: Uuid,
		/** Required localized alternative text is represented by a Unit. */
		altUnitId: Uuid,
		captionUnitId: Type.Optional(Uuid),
		target: Type.Optional(NavigationTarget),
		appearance: Type.Union([
			Type.Literal("content"),
			Type.Literal("cover"),
			Type.Literal("banner"),
			Type.Literal("avatar"),
		]),
		fit: Type.Union([Type.Literal("contain"), Type.Literal("cover")]),
	},
	{ additionalProperties: false, $id: "MediaBlock" },
);
export type MediaBlock = Static<typeof MediaBlock>;

export const DividerBlock = Type.Object(
	{
		_type: Type.Literal("divider"),
		_key: BlockKey,
		style: Type.Union([Type.Literal("line"), Type.Literal("space"), Type.Literal("section")]),
	},
	{ additionalProperties: false, $id: "DividerBlock" },
);
export type DividerBlock = Static<typeof DividerBlock>;

const ReferencedAtomicBlocks = [
	UnitRefBlock,
	UnitListBlock,
	SearchBlock,
	MenuBlock,
	MediaBlock,
	DividerBlock,
] as const;

function createContainerBlocks<ThisSchema extends TSchema>(This: ThisSchema) {
	return [
		Type.Object(
			{
				_type: Type.Literal("group"),
				_key: BlockKey,
				layout: Type.Union([
					Type.Literal("stack"),
					Type.Literal("row"),
					Type.Literal("grid"),
				]),
				blocks: Type.Array(This, { minItems: 1, maxItems: 50 }),
			},
			{ additionalProperties: false },
		),
		Type.Object(
			{
				_type: Type.Literal("callout"),
				_key: BlockKey,
				tone: Type.Union([
					Type.Literal("neutral"),
					Type.Literal("info"),
					Type.Literal("success"),
					Type.Literal("warning"),
					Type.Literal("danger"),
				]),
				labelUnitId: Type.Optional(Uuid),
				blocks: Type.Array(This, { minItems: 1, maxItems: 20 }),
			},
			{ additionalProperties: false },
		),
		Type.Object(
			{
				_type: Type.Literal("tabs"),
				_key: BlockKey,
				tabs: Type.Array(
					Type.Object(
						{
							_key: BlockKey,
							labelUnitId: Uuid,
							blocks: Type.Array(This, { minItems: 1, maxItems: 50 }),
						},
						{ additionalProperties: false },
					),
					{ minItems: 2, maxItems: 12 },
				),
			},
			{ additionalProperties: false },
		),
	] as const;
}

export const Block = Type.Recursive(
	(This) =>
		Type.Union([
			PortableTextDocument,
			...ReferencedAtomicBlocks,
			...createContainerBlocks(This),
		]),
	{ $id: "Block" },
);
export type Block = Static<typeof Block>;

/** Composition-only Block variant whose display copy must be referenced through Units. */
export const UnitReferencedBlock = Type.Recursive(
	(This) => Type.Union([...ReferencedAtomicBlocks, ...createContainerBlocks(This)]),
	{ $id: "UnitReferencedBlock" },
);
export type UnitReferencedBlock = Static<typeof UnitReferencedBlock>;

export const BlockDocument = Type.Object(
	{
		_type: Type.Literal("block-document"),
		_key: BlockKey,
		blocks: Type.Array(Block, { maxItems: 100 }),
	},
	{ additionalProperties: false, $id: "BlockDocument" },
);
export type BlockDocument = Static<typeof BlockDocument>;

export const UnitReferencedBlockDocument = Type.Object(
	{
		_type: Type.Literal("block-document"),
		_key: BlockKey,
		blocks: Type.Array(UnitReferencedBlock, { maxItems: 100 }),
	},
	{ additionalProperties: false, $id: "UnitReferencedBlockDocument" },
);
export type UnitReferencedBlockDocument = Static<typeof UnitReferencedBlockDocument>;

export function createBlockDocument(
	blocks: Block[] = [],
	key: BlockKey = createBlockKey(),
): BlockDocument {
	return { _type: "block-document", _key: key, blocks };
}

export function createUnitReferencedBlockDocument(
	blocks: UnitReferencedBlock[] = [],
	key: BlockKey = createBlockKey(),
): UnitReferencedBlockDocument {
	return { _type: "block-document", _key: key, blocks };
}

export const BlockTypeValues = [
	"portable-text",
	"unit-ref",
	"unit-list",
	"search",
	"menu",
	"media",
	"divider",
	"group",
	"callout",
	"tabs",
] as const;
export type BlockType = (typeof BlockTypeValues)[number];

export function createPortableTextDocument(
	content: PortableTextValue,
	key: BlockKey = createBlockKey(),
): PortableTextDocument {
	return { _type: "portable-text", _key: key, content };
}

export function updatePortableTextDocument(
	document: PortableTextDocument,
	content: PortableTextValue,
): PortableTextDocument {
	return { ...document, content };
}
