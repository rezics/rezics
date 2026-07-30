import type { SearchTemplateId, SimpleFeedContentKind } from "@rezics/filter";

const UnitPostContentKinds = [
	"post:post",
	"post:excerpt",
	"post:review",
	"post:chapter",
	"post:wiki",
	"post:picture",
] as const satisfies readonly SimpleFeedContentKind[];

const UnitZoneContentKinds = {
	book: ["unit:book", "unit:collection", ...UnitPostContentKinds],
	media: ["unit:media", "unit:collection", ...UnitPostContentKinds],
	software: ["unit:software", "unit:collection", ...UnitPostContentKinds],
} as const satisfies Record<string, readonly SimpleFeedContentKind[]>;

export function workZoneFeedContentKinds(
	template: SearchTemplateId,
): readonly SimpleFeedContentKind[] | undefined {
	if (!(template in UnitZoneContentKinds)) return undefined;
	return UnitZoneContentKinds[template as keyof typeof UnitZoneContentKinds];
}
