import { BlockClassNamePrefix, type BlockType, BlockTypeValues } from "./blocks";

/** Styling-contract SemVer is independent from the REZICS product RomVer. */
export const ZoneStylingContractVersion = "3.1.0" as const;

export const ZoneStylingContractRootAttributeValues = ["data-block-type"] as const;
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

export const ZoneStylingContractRichTextBoundaryAttribute = "data-portable-text" as const;
export const ZoneStylingContractRichTextElementValues = [
	"p",
	"h2",
	"h3",
	"blockquote",
	"ul",
	"ol",
	"li",
	"a",
	"figure",
	"img",
	"figcaption",
] as const;
export type ZoneStylingContractRichTextElement =
	(typeof ZoneStylingContractRichTextElementValues)[number];

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
			"data-appearance": ["default", "identity-badge"],
			"data-layout": ["list", "grid", "carousel", "wrap"],
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
	customClassNamePrefix: BlockClassNamePrefix,
	rootAttributes: ZoneStylingContractRootAttributeValues,
	blocks: ZoneBlockStylingContractRegistry,
	cssVariables: ZoneStylingContractCssVariableValues,
	richText: {
		boundaryAttribute: ZoneStylingContractRichTextBoundaryAttribute,
		elements: ZoneStylingContractRichTextElementValues,
	},
} as const;
