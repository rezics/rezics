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

export const ZoneThemeColorSchemeValues = ["system", "light", "dark"] as const;
export type ZoneThemeColorScheme = (typeof ZoneThemeColorSchemeValues)[number];

export const ZoneThemeDensityValues = ["comfortable", "compact"] as const;
export type ZoneThemeDensity = (typeof ZoneThemeDensityValues)[number];

export const ZoneThemeCardRadiusValues = ["sm", "md", "lg"] as const;
export type ZoneThemeCardRadius = (typeof ZoneThemeCardRadiusValues)[number];

export const ZoneThemeHeadingFontScaleValues = ["sm", "md", "lg"] as const;
export type ZoneThemeHeadingFontScale = (typeof ZoneThemeHeadingFontScaleValues)[number];

export const ZoneThemeSurfaceTintValues = ["none", "subtle", "accent"] as const;
export type ZoneThemeSurfaceTint = (typeof ZoneThemeSurfaceTintValues)[number];

export const ZoneCustomThemeReference = Type.Object(
	{
		themeUnitId: Uuid,
		revisionId: Uuid,
	},
	{ additionalProperties: false, $id: "ZoneCustomThemeReference" },
);
export type ZoneCustomThemeReference = Static<typeof ZoneCustomThemeReference>;

export const ZoneThemeDocument = Type.Object(
	{
		_type: Type.Literal("zone-theme"),
		_key: BlockKey,
		colorScheme: Type.Union([
			Type.Literal(ZoneThemeColorSchemeValues[0]),
			Type.Literal(ZoneThemeColorSchemeValues[1]),
			Type.Literal(ZoneThemeColorSchemeValues[2]),
		]),
		accent: Type.String({
			pattern: "^#[0-9a-fA-F]{6}$",
		}),
		density: Type.Union([
			Type.Literal(ZoneThemeDensityValues[0]),
			Type.Literal(ZoneThemeDensityValues[1]),
		]),
		heroAssetId: Type.Optional(Uuid),
		cardRadius: Type.Optional(
			Type.Union([
				Type.Literal(ZoneThemeCardRadiusValues[0]),
				Type.Literal(ZoneThemeCardRadiusValues[1]),
				Type.Literal(ZoneThemeCardRadiusValues[2]),
			]),
		),
		headingFontScale: Type.Optional(
			Type.Union([
				Type.Literal(ZoneThemeHeadingFontScaleValues[0]),
				Type.Literal(ZoneThemeHeadingFontScaleValues[1]),
				Type.Literal(ZoneThemeHeadingFontScaleValues[2]),
			]),
		),
		surfaceTint: Type.Optional(
			Type.Union([
				Type.Literal(ZoneThemeSurfaceTintValues[0]),
				Type.Literal(ZoneThemeSurfaceTintValues[1]),
				Type.Literal(ZoneThemeSurfaceTintValues[2]),
			]),
		),
		custom: Type.Optional(ZoneCustomThemeReference),
	},
	{ additionalProperties: false, $id: "ZoneThemeDocument" },
);
export type ZoneThemeDocument = Static<typeof ZoneThemeDocument>;

export type ZoneThemeTokens = Omit<ZoneThemeDocument, "_type" | "_key" | "custom">;

/** Renderer fallbacks for optional Level 1 members and new Zone creation. */
export const ZoneThemeTokenDefaults = {
	colorScheme: "system",
	accent: "#2563eb",
	density: "comfortable",
	cardRadius: "md",
	headingFontScale: "md",
	surfaceTint: "none",
} as const satisfies Required<Omit<ZoneThemeTokens, "heroAssetId">>;

export const ZoneThemePresetIdValues = ["clean", "editorial", "vibrant"] as const;
export type ZoneThemePresetId = (typeof ZoneThemePresetIdValues)[number];

export type ZoneThemePresetTokens = Required<Omit<ZoneThemeTokens, "heroAssetId">> &
	Pick<ZoneThemeTokens, "heroAssetId">;

export interface ZoneThemePreset {
	readonly id: ZoneThemePresetId;
	readonly tokens: ZoneThemePresetTokens;
}

/**
 * Platform-curated token bundles. Display names and descriptions belong to
 * typed localization resources and are intentionally not part of this registry.
 */
export const ZoneThemePresetRegistry = {
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
} as const satisfies Record<ZoneThemePresetId, ZoneThemePreset>;

/**
 * Copies a preset's token values into a document while preserving its identity.
 * Preset identity is never persisted, so later registry changes cannot silently
 * restyle an existing Zone.
 */
export function applyZoneThemePreset(
	document: ZoneThemeDocument,
	presetId: ZoneThemePresetId,
): ZoneThemeDocument {
	return {
		_type: document._type,
		_key: document._key,
		...ZoneThemePresetRegistry[presetId].tokens,
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

export function createZoneThemeDocument(
	input: Pick<ZoneThemeDocument, "accent"> &
		Partial<
			Pick<
				ZoneThemeDocument,
				| "colorScheme"
				| "density"
				| "heroAssetId"
				| "cardRadius"
				| "headingFontScale"
				| "surfaceTint"
				| "custom"
			>
		>,
	key: BlockKey = createBlockKey(),
): ZoneThemeDocument {
	return {
		_type: "zone-theme",
		_key: key,
		colorScheme: input.colorScheme ?? ZoneThemeTokenDefaults.colorScheme,
		accent: input.accent,
		density: input.density ?? ZoneThemeTokenDefaults.density,
		...(input.heroAssetId === undefined ? {} : { heroAssetId: input.heroAssetId }),
		...(input.cardRadius === undefined ? {} : { cardRadius: input.cardRadius }),
		...(input.headingFontScale === undefined ? {} : { headingFontScale: input.headingFontScale }),
		...(input.surfaceTint === undefined ? {} : { surfaceTint: input.surfaceTint }),
		...(input.custom === undefined ? {} : { custom: input.custom }),
	};
}
