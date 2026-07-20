import type { SearchCategory as SearchCategoryValue, SearchFilter } from "@rezics/search";
import { SearchCategory, SearchFilter as SearchFilterSchema } from "@rezics/search";
import { type Static, Type } from "@sinclair/typebox";

import { BlockKey, createBlockKey } from "./identity";
import { NavigationTarget } from "./blocks";

const Uuid = Type.String({
	pattern:
		"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
});

/**
 * Localized presentation for one stable Poll option.
 *
 * The label deliberately remains plain text. A future contract may add an
 * optional `description: PortableText` without widening the label.
 */
export const PollContentOption = Type.Object(
	{
		optionId: Uuid,
		label: Type.String({ minLength: 1, maxLength: 500 }),
	},
	{ additionalProperties: false },
);
export type PollContentOption = Static<typeof PollContentOption>;

export const PollContentBlock = Type.Object(
	{
		_type: Type.Literal("poll-content"),
		_key: BlockKey,
		options: Type.Array(PollContentOption, { minItems: 2, maxItems: 50 }),
	},
	{ additionalProperties: false, $id: "PollContentBlock" },
);
export type PollContentBlock = Static<typeof PollContentBlock>;

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
				source: Type.Literal("search"),
				categories: Type.Array(SearchCategory, { minItems: 1, maxItems: 9 }),
				filters: Type.Array(SearchFilterSchema, { maxItems: 50 }),
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
	{ additionalProperties: false, $id: "CollectionPresentationDocument" },
);
export type CollectionPresentationDocument = Static<typeof CollectionPresentationDocument>;

export const ZoneBoundaryDocument = Type.Object(
	{
		_type: Type.Literal("zone-boundary"),
		_key: BlockKey,
		categories: Type.Array(SearchCategory, { minItems: 1, maxItems: 9 }),
		filters: Type.Array(SearchFilterSchema, { maxItems: 50 }),
	},
	{ additionalProperties: false, $id: "ZoneBoundaryDocument" },
);
export type ZoneBoundaryDocument = Static<typeof ZoneBoundaryDocument>;

export const ZoneThemeDocument = Type.Object(
	{
		_type: Type.Literal("zone-theme"),
		_key: BlockKey,
		colorScheme: Type.Union([
			Type.Literal("system"),
			Type.Literal("light"),
			Type.Literal("dark"),
		]),
		accent: Type.String({
			pattern: "^#[0-9a-fA-F]{6}$",
		}),
		density: Type.Union([Type.Literal("comfortable"), Type.Literal("compact")]),
	},
	{ additionalProperties: false, $id: "ZoneThemeDocument" },
);
export type ZoneThemeDocument = Static<typeof ZoneThemeDocument>;

export const NavigationItem = Type.Recursive(
	(This) =>
		Type.Union([
			Type.Object(
				{
					_key: BlockKey,
					labelUnitId: Uuid,
					target: NavigationTarget,
				},
				{ additionalProperties: false },
			),
			Type.Object(
				{
					_key: BlockKey,
					labelUnitId: Uuid,
					children: Type.Array(This, { minItems: 1, maxItems: 20 }),
				},
				{ additionalProperties: false },
			),
		]),
	{ $id: "NavigationItem" },
);
export type NavigationItem = Static<typeof NavigationItem>;

/** Navigation content is independent from the Menu Block that renders it. */
export const NavigationDocument = Type.Object(
	{
		_type: Type.Literal("navigation-document"),
		_key: BlockKey,
		items: Type.Array(NavigationItem, { minItems: 1, maxItems: 100 }),
	},
	{ additionalProperties: false, $id: "NavigationDocument" },
);
export type NavigationDocument = Static<typeof NavigationDocument>;

export function createPollContentBlock(
	options: PollContentOption[],
	key: BlockKey = createBlockKey(),
): PollContentBlock {
	return { _type: "poll-content", _key: key, options };
}

export function createManualCollectionDefinitionDocument(
	key: BlockKey = createBlockKey(),
): CollectionDefinitionDocument {
	return { _type: "collection-definition", _key: key, source: "manual" };
}

export function createSearchCollectionDefinitionDocument(
	categories: SearchCategoryValue[],
	filters: SearchFilter[] = [],
	key: BlockKey = createBlockKey(),
): CollectionDefinitionDocument {
	return { _type: "collection-definition", _key: key, source: "search", categories, filters };
}

export function createSystemCollectionDefinitionDocument(
	systemKey: "favorites",
	key: BlockKey = createBlockKey(),
): CollectionDefinitionDocument {
	return { _type: "collection-definition", _key: key, source: "system", systemKey };
}

export function createCollectionPresentationDocument(
	layout: CollectionPresentationDocument["layout"] = "flat",
	order: CollectionPresentationDocument["order"] = "manual",
	key: BlockKey = createBlockKey(),
): CollectionPresentationDocument {
	return { _type: "collection-presentation", _key: key, layout, order };
}

export function createZoneBoundaryDocument(
	categories: Static<typeof SearchCategory>[],
	filters: SearchFilter[] = [],
	key: BlockKey = createBlockKey(),
): ZoneBoundaryDocument {
	return { _type: "zone-boundary", _key: key, categories, filters };
}

export function createZoneThemeDocument(
	input: Pick<ZoneThemeDocument, "accent"> &
		Partial<Pick<ZoneThemeDocument, "colorScheme" | "density">>,
	key: BlockKey = createBlockKey(),
): ZoneThemeDocument {
	return {
		_type: "zone-theme",
		_key: key,
		colorScheme: input.colorScheme ?? "system",
		accent: input.accent,
		density: input.density ?? "comfortable",
	};
}
