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

export const ZoneAppearanceColorSchemeValues = ["system", "light", "dark"] as const;
export type ZoneAppearanceColorScheme = (typeof ZoneAppearanceColorSchemeValues)[number];

export const ZoneAppearanceDensityValues = ["comfortable", "compact"] as const;
export type ZoneAppearanceDensity = (typeof ZoneAppearanceDensityValues)[number];

export const ZoneAppearanceCardRadiusValues = ["sm", "md", "lg"] as const;
export type ZoneAppearanceCardRadius = (typeof ZoneAppearanceCardRadiusValues)[number];

export const ZoneAppearanceHeadingFontScaleValues = ["sm", "md", "lg"] as const;
export type ZoneAppearanceHeadingFontScale = (typeof ZoneAppearanceHeadingFontScaleValues)[number];

export const ZoneAppearanceSurfaceTintValues = ["none", "subtle", "accent"] as const;
export type ZoneAppearanceSurfaceTint = (typeof ZoneAppearanceSurfaceTintValues)[number];

export const ZoneAppearanceDocument = Type.Object(
	{
		_type: Type.Literal("zone-appearance"),
		_key: BlockKey,
		colorScheme: Type.Union([
			Type.Literal(ZoneAppearanceColorSchemeValues[0]),
			Type.Literal(ZoneAppearanceColorSchemeValues[1]),
			Type.Literal(ZoneAppearanceColorSchemeValues[2]),
		]),
		accent: Type.String({
			pattern: "^#[0-9a-fA-F]{6}$",
		}),
		density: Type.Union([
			Type.Literal(ZoneAppearanceDensityValues[0]),
			Type.Literal(ZoneAppearanceDensityValues[1]),
		]),
		heroAssetId: Type.Optional(Uuid),
		cardRadius: Type.Optional(
			Type.Union([
				Type.Literal(ZoneAppearanceCardRadiusValues[0]),
				Type.Literal(ZoneAppearanceCardRadiusValues[1]),
				Type.Literal(ZoneAppearanceCardRadiusValues[2]),
			]),
		),
		headingFontScale: Type.Optional(
			Type.Union([
				Type.Literal(ZoneAppearanceHeadingFontScaleValues[0]),
				Type.Literal(ZoneAppearanceHeadingFontScaleValues[1]),
				Type.Literal(ZoneAppearanceHeadingFontScaleValues[2]),
			]),
		),
		surfaceTint: Type.Optional(
			Type.Union([
				Type.Literal(ZoneAppearanceSurfaceTintValues[0]),
				Type.Literal(ZoneAppearanceSurfaceTintValues[1]),
				Type.Literal(ZoneAppearanceSurfaceTintValues[2]),
			]),
		),
	},
	{ additionalProperties: false, $id: "ZoneAppearanceDocument" },
);
export type ZoneAppearanceDocument = Static<typeof ZoneAppearanceDocument>;

export type ZoneAppearanceTokens = Omit<ZoneAppearanceDocument, "_type" | "_key">;

/** Renderer fallbacks for optional Level 1 members and new Zone creation. */
export const ZoneAppearanceTokenDefaults = {
	colorScheme: "system",
	accent: "#2563eb",
	density: "comfortable",
	cardRadius: "md",
	headingFontScale: "md",
	surfaceTint: "none",
} as const satisfies Required<Omit<ZoneAppearanceTokens, "heroAssetId">>;

export const ZoneAppearancePresetIdValues = ["clean", "editorial", "vibrant"] as const;
export type ZoneAppearancePresetId = (typeof ZoneAppearancePresetIdValues)[number];

export type ZoneAppearancePresetTokens = Required<Omit<ZoneAppearanceTokens, "heroAssetId">> &
	Pick<ZoneAppearanceTokens, "heroAssetId">;

export interface ZoneAppearancePreset {
	readonly id: ZoneAppearancePresetId;
	readonly tokens: ZoneAppearancePresetTokens;
}

/**
 * Platform-curated token bundles. Display names and descriptions belong to
 * typed localization resources and are intentionally not part of this registry.
 */
export const ZoneAppearancePresetRegistry = {
	clean: {
		id: "clean",
		tokens: {
			colorScheme: "system",
			accent: "#2563eb",
			density: "comfortable",
			cardRadius: "md",
			headingFontScale: "md",
			surfaceTint: "none",
		},
	},
	editorial: {
		id: "editorial",
		tokens: {
			colorScheme: "light",
			accent: "#a16207",
			density: "comfortable",
			cardRadius: "sm",
			headingFontScale: "lg",
			surfaceTint: "subtle",
		},
	},
	vibrant: {
		id: "vibrant",
		tokens: {
			colorScheme: "dark",
			accent: "#7c3aed",
			density: "comfortable",
			cardRadius: "lg",
			headingFontScale: "lg",
			surfaceTint: "accent",
		},
	},
} as const satisfies Record<ZoneAppearancePresetId, ZoneAppearancePreset>;

/**
 * Copies a preset's token values into a document while preserving its identity.
 * Preset identity is never persisted, so later registry changes cannot silently
 * restyle an existing Zone.
 */
export function applyZoneAppearancePreset(
	document: ZoneAppearanceDocument,
	presetId: ZoneAppearancePresetId,
): ZoneAppearanceDocument {
	return {
		_type: document._type,
		_key: document._key,
		...ZoneAppearancePresetRegistry[presetId].tokens,
	};
}

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

export function createZoneAppearanceDocument(
	input: Pick<ZoneAppearanceDocument, "accent"> &
		Partial<
			Pick<
				ZoneAppearanceDocument,
				| "colorScheme"
				| "density"
				| "heroAssetId"
				| "cardRadius"
				| "headingFontScale"
				| "surfaceTint"
			>
		>,
	key: BlockKey = createBlockKey(),
): ZoneAppearanceDocument {
	return {
		_type: "zone-appearance",
		_key: key,
		colorScheme: input.colorScheme ?? ZoneAppearanceTokenDefaults.colorScheme,
		accent: input.accent,
		density: input.density ?? ZoneAppearanceTokenDefaults.density,
		...(input.heroAssetId === undefined ? {} : { heroAssetId: input.heroAssetId }),
		...(input.cardRadius === undefined ? {} : { cardRadius: input.cardRadius }),
		...(input.headingFontScale === undefined ? {} : { headingFontScale: input.headingFontScale }),
		...(input.surfaceTint === undefined ? {} : { surfaceTint: input.surfaceTint }),
	};
}
