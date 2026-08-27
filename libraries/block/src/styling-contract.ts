import { type BlockType, BlockTypeValues } from "./blocks";

/** Styling-contract SemVer is independent from the REZICS product RomVer. */
export const ZoneStylingContractVersion = "2.0.0" as const;

export const ZoneStylingContractRootAttributeValues = [
	"data-block-type",
	"data-style-role",
] as const;
export type ZoneStylingContractRootAttribute =
	(typeof ZoneStylingContractRootAttributeValues)[number];

export const ZoneStylingContractStateAttributeValues = [
	"data-appearance",
	"data-layout",
	"data-item-size",
] as const;
export type ZoneStylingContractStateAttribute =
	(typeof ZoneStylingContractStateAttributeValues)[number];

export const ZoneStylingContractCssVariableValues = [
	"--rezics-zone-accent",
	"--rezics-zone-accent-foreground",
	"--rezics-zone-density",
	"--rezics-zone-card-radius",
	"--rezics-zone-heading-font-scale",
	"--rezics-zone-surface-tint",
] as const;
export type ZoneStylingContractCssVariable = (typeof ZoneStylingContractCssVariableValues)[number];

export interface ZoneBlockStylingContract {
	readonly parts: readonly string[];
	readonly stateAttributes: Readonly<
		Partial<Record<ZoneStylingContractStateAttribute, readonly string[]>>
	>;
}

/**
 * The complete public selector surface for each Block type. Keeping this map
 * exhaustive makes a newly introduced Block type a deliberate contract change.
 */
export const ZoneBlockStylingContractRegistry = {
	"portable-text": {
		parts: ["content"],
		stateAttributes: {},
	},
	"post-full-view": {
		parts: ["header", "title", "summary", "content"],
		stateAttributes: {},
	},
	"unit-ref": {
		parts: ["link", "card", "cover", "title", "summary"],
		stateAttributes: {
			"data-appearance": ["inline", "card", "cover"],
		},
	},
	"unit-list": {
		parts: ["heading", "view-all", "items", "item", "action", "loading", "empty", "error"],
		stateAttributes: {
			"data-layout": ["list", "grid", "carousel"],
			"data-item-size": ["sm", "md", "lg"],
		},
	},
	search: {
		parts: ["form", "query", "submit", "filters"],
		stateAttributes: {},
	},
	feed: {
		parts: ["toolbar", "items", "item", "continuation", "loading", "empty", "error"],
		stateAttributes: {},
	},
	menu: {
		parts: ["list", "item", "label", "link"],
		stateAttributes: {
			"data-appearance": ["links", "buttons", "tabs", "drawer"],
		},
	},
	image: {
		parts: ["figure", "asset", "caption"],
		stateAttributes: {},
	},
	"url-image": {
		parts: ["figure", "asset", "caption"],
		stateAttributes: {},
	},
	divider: {
		parts: ["separator"],
		stateAttributes: {},
	},
	columns: {
		parts: ["column"],
		stateAttributes: {},
	},
	group: {
		parts: ["content"],
		stateAttributes: {
			"data-layout": ["stack", "row", "grid"],
		},
	},
	callout: {
		parts: ["title", "content"],
		stateAttributes: {},
	},
	tabs: {
		parts: ["list", "tab", "panel"],
		stateAttributes: {},
	},
} as const satisfies Record<BlockType, ZoneBlockStylingContract>;

export const ZoneStylingContract = {
	version: ZoneStylingContractVersion,
	blockTypes: BlockTypeValues,
	rootAttributes: ZoneStylingContractRootAttributeValues,
	blocks: ZoneBlockStylingContractRegistry,
	cssVariables: ZoneStylingContractCssVariableValues,
} as const;
