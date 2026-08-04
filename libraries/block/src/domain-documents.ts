import { UnitPredicate as UnitPredicateSchema, type UnitPredicate } from "@rezics/filter";
import { SearchCategory } from "@rezics/filter";
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

export const ZoneBoundaryDocument = Type.Object(
	{
		_type: Type.Literal("zone-boundary"),
		_key: BlockKey,
		categories: Type.Array(SearchCategory, { minItems: 1, maxItems: 9 }),
		filter: Type.Optional(Type.Unsafe<UnitPredicate>(UnitPredicateSchema)),
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
					children: Type.Array(This, { minItems: 1 }),
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
		items: Type.Array(NavigationItem, { minItems: 1 }),
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

export function createZoneBoundaryDocument(
	categories: Static<typeof SearchCategory>[],
	filter?: UnitPredicate,
	key: BlockKey = createBlockKey(),
): ZoneBoundaryDocument {
	return {
		_type: "zone-boundary",
		_key: key,
		categories,
		...(filter ? { filter } : {}),
	};
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
