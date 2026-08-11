/** @alpha */
export const rezicsMarkdownFeatureIds = Object.freeze([
	"commonmark",
	"gfm-autolink",
	"gfm-strikethrough",
	"gfm-table",
	"gfm-task-list",
	"raw-block-html-inert",
] as const);

/** @alpha */
export type RezicsMarkdownFeatureId = (typeof rezicsMarkdownFeatureIds)[number];

/** @alpha */
export interface RezicsMarkdownDialectDescriptor {
	readonly id: "rezics-markdown";
	readonly version: 1;
	readonly mediaTypes: readonly ["text/markdown", "text/x-rezics-markdown"];
	readonly extensions: readonly [".md", ".markdown"];
	readonly features: readonly RezicsMarkdownFeatureId[];
}

/**
 * The immutable descriptor for the first supported REZICS Markdown grammar.
 *
 * @alpha
 */
export const rezicsMarkdownDialect: RezicsMarkdownDialectDescriptor = Object.freeze({
	id: "rezics-markdown",
	version: 1,
	mediaTypes: Object.freeze(["text/markdown", "text/x-rezics-markdown"] as const),
	extensions: Object.freeze([".md", ".markdown"] as const),
	features: rezicsMarkdownFeatureIds,
} as const);
