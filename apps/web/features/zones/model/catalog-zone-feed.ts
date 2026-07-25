import type { SimpleFeedContentKind } from "@rezics/filter";

const CatalogPostContentKinds = [
	"post:post",
	"post:excerpt",
	"post:review",
	"post:chapter",
	"post:chapter_group",
	"post:wiki",
	"post:picture",
] as const satisfies readonly SimpleFeedContentKind[];

const CatalogZoneContentKinds = {
	book: ["unit:book", "unit:collection", ...CatalogPostContentKinds],
	media: ["unit:media", "unit:collection", ...CatalogPostContentKinds],
	software: ["unit:software", "unit:collection", ...CatalogPostContentKinds],
} as const satisfies Record<string, readonly SimpleFeedContentKind[]>;

export function catalogZoneFeedContentKinds(
	slug: string | null | undefined,
): readonly SimpleFeedContentKind[] | undefined {
	if (!slug || !(slug in CatalogZoneContentKinds)) return undefined;
	return CatalogZoneContentKinds[slug as keyof typeof CatalogZoneContentKinds];
}
