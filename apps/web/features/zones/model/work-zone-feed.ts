import type { FilterDocument, SimpleFeedContentKind } from "@rezics/filter";

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
	filterDocument: FilterDocument,
): readonly SimpleFeedContentKind[] | undefined {
	const candidates = [filterDocument.where, ...(filterDocument.where?.any ?? [])];
	for (const candidate of candidates) {
		const kinds = candidate?.kind?.in;
		if (kinds?.length !== 1) continue;
		const [kind] = kinds;
		if (kind === "book" || kind === "media" || kind === "software")
			return UnitZoneContentKinds[kind];
	}
	return undefined;
}
