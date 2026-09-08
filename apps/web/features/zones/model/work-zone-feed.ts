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
	publishing: [
		"publishing:work",
		"publishing:text_version",
		"publishing:publication",
		"collection:collection",
		...UnitPostContentKinds,
	],
	program: ["program:program", "collection:collection", ...UnitPostContentKinds],
	software: [
		"software:content",
		"software:version",
		"software:release",
		"collection:collection",
		...UnitPostContentKinds,
	],
} as const satisfies Record<string, readonly SimpleFeedContentKind[]>;

export function workZoneFeedContentKinds(
	filterDocument: FilterDocument,
): readonly SimpleFeedContentKind[] | undefined {
	const candidates = [filterDocument.where, ...(filterDocument.where?.any ?? [])];
	for (const candidate of candidates) {
		const kinds = candidate?.owner?.in;
		if (kinds?.length !== 1) continue;
		const [kind] = kinds;
		if (kind === "publishing" || kind === "program" || kind === "software")
			return UnitZoneContentKinds[kind];
	}
	return undefined;
}
