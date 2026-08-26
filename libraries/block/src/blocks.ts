import { FilterDocument, SearchSort } from "@rezics/filter";
import { PortableText, type PortableTextValue } from "@rezics/portable-text";
import { type Static, type TSchema, Type } from "@sinclair/typebox";

import { BlockKey, createBlockKey } from "./identity";

const Uuid = Type.String({
	pattern:
		"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
});

/** Reusable semantic styling hook. It is intentionally not an identity. */
export const BlockStyleRole = Type.String({
	minLength: 1,
	maxLength: 48,
	pattern: "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$",
});
export type BlockStyleRole = Static<typeof BlockStyleRole>;

export const BlockStyleRoles = Type.Array(BlockStyleRole, {
	maxItems: 8,
	uniqueItems: true,
});
export type BlockStyleRoles = Static<typeof BlockStyleRoles>;

const BlockStyleFields = {
	styleRoles: Type.Optional(BlockStyleRoles),
};

export const PortableTextDocument = Type.Object(
	{
		_type: Type.Literal("portable-text"),
		_key: BlockKey,
		...BlockStyleFields,
		content: PortableText,
	},
	{ additionalProperties: false, $id: "PortableTextDocument" },
);
export type PortableTextDocument = Static<typeof PortableTextDocument>;

export const UnitRefBlock = Type.Object(
	{
		_type: Type.Literal("unit-ref"),
		_key: BlockKey,
		...BlockStyleFields,
		unitId: Uuid,
		appearance: Type.Union([Type.Literal("inline"), Type.Literal("card"), Type.Literal("cover")]),
	},
	{ additionalProperties: false, $id: "UnitRefBlock" },
);
export type UnitRefBlock = Static<typeof UnitRefBlock>;

/** Render a Wiki Post as a complete content surface within the current host. */
export const PostFullViewBlock = Type.Object(
	{
		_type: Type.Literal("post-full-view"),
		_key: BlockKey,
		...BlockStyleFields,
		postId: Uuid,
	},
	{ additionalProperties: false, $id: "PostFullViewBlock" },
);
export type PostFullViewBlock = Static<typeof PostFullViewBlock>;

export const DirectSearchFeatureSource = Type.Union([
	Type.Object({ kind: Type.Literal("global") }, { additionalProperties: false }),
	Type.Object({ kind: Type.Literal("zone") }, { additionalProperties: false }),
	Type.Object(
		{ kind: Type.Literal("inline"), filterDocument: FilterDocument },
		{ additionalProperties: false },
	),
]);
export type DirectSearchFeatureSource = Static<typeof DirectSearchFeatureSource>;

export const DerivedSearchSelector = Type.Object(
	{
		kind: Type.Literal("random-tag"),
		from: Type.Union([
			Type.Object(
				{ kind: Type.Literal("collection"), collectionId: Uuid },
				{ additionalProperties: false },
			),
			Type.Object({ kind: Type.Literal("viewer-follows") }, { additionalProperties: false }),
		]),
		seed: Type.Union([
			Type.Object(
				{
					kind: Type.Literal("time-bucket"),
					hours: Type.Union([Type.Literal(1), Type.Literal(6), Type.Literal(24)]),
				},
				{ additionalProperties: false },
			),
			Type.Object({ kind: Type.Literal("request") }, { additionalProperties: false }),
		]),
	},
	{ additionalProperties: false, $id: "DerivedSearchSelector" },
);
export type DerivedSearchSelector = Static<typeof DerivedSearchSelector>;

export const DerivedSearchFeatureSource = Type.Object(
	{
		kind: Type.Literal("derived"),
		select: DerivedSearchSelector,
		query: Type.Object(
			{
				feature: DirectSearchFeatureSource,
				sort: Type.Optional(SearchSort),
			},
			{ additionalProperties: false },
		),
		fallback: Type.Union([
			Type.Object({ kind: Type.Literal("hide") }, { additionalProperties: false }),
			Type.Object(
				{ kind: Type.Literal("collection"), collectionId: Uuid },
				{ additionalProperties: false },
			),
		]),
	},
	{ additionalProperties: false, $id: "DerivedSearchFeatureSource" },
);
export type DerivedSearchFeatureSource = Static<typeof DerivedSearchFeatureSource>;

export const SearchFeatureSource = Type.Union([
	DirectSearchFeatureSource,
	DerivedSearchFeatureSource,
]);
export type SearchFeatureSource = Static<typeof SearchFeatureSource>;

export const NavigationTarget = Type.Union([
	Type.Object({ kind: Type.Literal("unit"), unitId: Uuid }, { additionalProperties: false }),
	Type.Object(
		{
			kind: Type.Literal("external"),
			url: Type.String({ minLength: 1, maxLength: 2_000, pattern: "^https://" }),
		},
		{ additionalProperties: false },
	),
]);
export type NavigationTarget = Static<typeof NavigationTarget>;

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
		{
			kind: Type.Literal("search"),
			feature: DirectSearchFeatureSource,
			sort: Type.Optional(SearchSort),
		},
		{ additionalProperties: false },
	),
	DerivedSearchFeatureSource,
]);

export const UnitListItemSizeValues = ["sm", "md", "lg"] as const;
export type UnitListItemSize = (typeof UnitListItemSizeValues)[number];

export const UnitListPresentation = Type.Object(
	{
		/** Renderers use `md` when this density hint is absent. */
		itemSize: Type.Optional(
			Type.Union([
				Type.Literal(UnitListItemSizeValues[0]),
				Type.Literal(UnitListItemSizeValues[1]),
				Type.Literal(UnitListItemSizeValues[2]),
			]),
		),
		headingUnitId: Type.Optional(Type.Union([Uuid, Type.Literal("selected")])),
		headingPrefixUnitId: Type.Optional(Uuid),
		viewAllTarget: Type.Optional(NavigationTarget),
	},
	{ additionalProperties: false, $id: "UnitListPresentation" },
);
export type UnitListPresentation = Static<typeof UnitListPresentation>;

export const UnitListBlock = Type.Object(
	{
		_type: Type.Literal("unit-list"),
		_key: BlockKey,
		...BlockStyleFields,
		source: UnitListSource,
		layout: Type.Union([Type.Literal("list"), Type.Literal("grid"), Type.Literal("carousel")]),
		limit: Type.Integer({ minimum: 1, maximum: 100 }),
		presentation: Type.Optional(UnitListPresentation),
	},
	{ additionalProperties: false, $id: "UnitListBlock" },
);
export type UnitListBlock = Static<typeof UnitListBlock>;

/** A scoped entry point into the Zone search surface; results render on that surface. */
export const SearchBlock = Type.Object(
	{
		_type: Type.Literal("search"),
		_key: BlockKey,
		...BlockStyleFields,
		feature: DirectSearchFeatureSource,
	},
	{ additionalProperties: false, $id: "SearchBlock" },
);
export type SearchBlock = Static<typeof SearchBlock>;

export const FeedPaginationModeValues = ["load-more", "infinite"] as const;
export type FeedPaginationMode = (typeof FeedPaginationModeValues)[number];

/** A continuously paged result stream driven by the same trusted Search schema. */
export const FeedBlock = Type.Object(
	{
		_type: Type.Literal("feed"),
		_key: BlockKey,
		...BlockStyleFields,
		feature: SearchFeatureSource,
		initialSort: Type.Optional(SearchSort),
		presentation: Type.Object(
			{
				pagination: Type.Union([
					Type.Literal(FeedPaginationModeValues[0]),
					Type.Literal(FeedPaginationModeValues[1]),
				]),
				showResultCount: Type.Boolean(),
			},
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false, $id: "FeedBlock" },
);
export type FeedBlock = Static<typeof FeedBlock>;

export const MenuBlock = Type.Object(
	{
		_type: Type.Literal("menu"),
		_key: BlockKey,
		...BlockStyleFields,
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
		...BlockStyleFields,
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
		...BlockStyleFields,
		style: Type.Union([Type.Literal("line"), Type.Literal("space"), Type.Literal("section")]),
	},
	{ additionalProperties: false, $id: "DividerBlock" },
);
export type DividerBlock = Static<typeof DividerBlock>;

const ReferencedAtomicBlocks = [
	PostFullViewBlock,
	UnitRefBlock,
	UnitListBlock,
	SearchBlock,
	FeedBlock,
	MenuBlock,
	MediaBlock,
	DividerBlock,
] as const;

function createContainerBlocks<ThisSchema extends TSchema>(This: ThisSchema) {
	return [
		Type.Object(
			{
				_type: Type.Literal("columns"),
				_key: BlockKey,
				...BlockStyleFields,
				columns: Type.Array(
					Type.Object(
						{
							_key: BlockKey,
							weight: Type.Integer({ minimum: 1, maximum: 12 }),
							blocks: Type.Array(This, { minItems: 1, maxItems: 50 }),
						},
						{ additionalProperties: false },
					),
					{ minItems: 2, maxItems: 12 },
				),
			},
			{ additionalProperties: false },
		),
		Type.Object(
			{
				_type: Type.Literal("group"),
				_key: BlockKey,
				...BlockStyleFields,
				layout: Type.Union([Type.Literal("stack"), Type.Literal("row"), Type.Literal("grid")]),
				blocks: Type.Array(This, { minItems: 1, maxItems: 50 }),
			},
			{ additionalProperties: false },
		),
		Type.Object(
			{
				_type: Type.Literal("callout"),
				_key: BlockKey,
				...BlockStyleFields,
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
				...BlockStyleFields,
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
		Type.Union([PortableTextDocument, ...ReferencedAtomicBlocks, ...createContainerBlocks(This)]),
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

/** Unit-owned composition rendered by a product route in a product-defined region. */
export const DockDocument = Type.Object(
	{
		_type: Type.Literal("dock-document"),
		_key: BlockKey,
		blocks: Type.Array(UnitReferencedBlock, { maxItems: 100 }),
	},
	{ additionalProperties: false, $id: "DockDocument" },
);
export type DockDocument = Static<typeof DockDocument>;

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

export function createDockDocument(
	blocks: UnitReferencedBlock[] = [],
	key: BlockKey = createBlockKey(),
): DockDocument {
	return { _type: "dock-document", _key: key, blocks };
}

export const BlockTypeValues = [
	"portable-text",
	"post-full-view",
	"unit-ref",
	"unit-list",
	"search",
	"feed",
	"menu",
	"media",
	"divider",
	"columns",
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
