import type { SearchTemplateId, SimpleFeedContentKind } from "@rezics/filter";

const CatalogPostContentKinds = [
	"post:post",
	"post:excerpt",
	"post:review",
	"post:chapter",
	"post:wiki",
	"post:picture",
] as const satisfies readonly SimpleFeedContentKind[];

const CatalogZoneContentKinds = {
	book: ["unit:book", "unit:collection", ...CatalogPostContentKinds],
	media: ["unit:media", "unit:collection", ...CatalogPostContentKinds],
	software: ["unit:software", "unit:collection", ...CatalogPostContentKinds],
} as const satisfies Record<string, readonly SimpleFeedContentKind[]>;

export function catalogZoneFeedContentKinds(
	template: SearchTemplateId,
): readonly SimpleFeedContentKind[] | undefined {
	if (!(template in CatalogZoneContentKinds)) return undefined;
	return CatalogZoneContentKinds[template as keyof typeof CatalogZoneContentKinds];
}
