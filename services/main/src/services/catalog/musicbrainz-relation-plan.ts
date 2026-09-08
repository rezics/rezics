import { isDeepStrictEqual } from "node:util";
import type { z } from "zod";
import type { MusicBrainzRelationSchema } from "./musicbrainz";

type Relation = z.infer<typeof MusicBrainzRelationSchema>;
export const MusicBrainzRelationEndpointFamilies = {
	artist: {
		owner: "entity",
		shape: "unresolved",
		shapes: ["person", "collective", "character", "unresolved"],
	},
	label: { owner: "entity", shape: "unresolved", shapes: ["label", "organization", "unresolved"] },
	area: { owner: "reference", shape: "area", shapes: ["area"] },
	place: { owner: "reference", shape: "place", shapes: ["place"] },
	event: { owner: "reference", shape: "event", shapes: ["event"] },
	instrument: { owner: "reference", shape: "instrument", shapes: ["instrument"] },
	series: { owner: "grouping", shape: "grouping", shapes: ["grouping"] },
	genre: { owner: "reference", shape: "concept", shapes: ["concept"] },
	mood: { owner: "reference", shape: "concept", shapes: ["concept"] },
	recording: { owner: "music", shape: "recording", shapes: ["recording"] },
	release: { owner: "music", shape: "release", shapes: ["release"] },
	"release-group": { owner: "music", shape: "release_group", shapes: ["release_group"] },
	work: { owner: "music", shape: "work", shapes: ["work"] },
	url: { owner: "reference", shape: "web_resource", shapes: ["web_resource"] },
} as const;

const identity = (relation: Relation) => {
	const kind =
		relation["target-type"] === "release_group" ? "release-group" : relation["target-type"];
	return JSON.stringify([relation["type-id"], kind, relation[kind]?.id, relation.direction]);
};

/** @internal Resolve unchanged occurrences first; changed duplicates without a unique correspondence require review. */
export function correlateMusicBrainzRelations(
	previous: readonly Relation[],
	incoming: readonly Relation[],
) {
	const used = new Set<number>();
	const result = incoming.map((relation) => {
		const match = previous.findIndex(
			(old, index) => !used.has(index) && isDeepStrictEqual(old, relation),
		);
		if (match !== -1) used.add(match);
		return match === -1 ? null : match;
	});
	return result.map((matched, index) => {
		if (matched !== null) return matched;
		const relation = incoming[index];
		if (!relation) throw new Error("Relationship correspondence omitted its source row");
		const candidates = previous.flatMap((old, position) =>
			!used.has(position) && identity(old) === identity(relation) ? [position] : [],
		);
		if (candidates.length > 1)
			throw new TypeError("Ambiguous repeated relationship delta requires explicit correspondence");
		const candidate = candidates[0];
		if (candidate !== undefined) used.add(candidate);
		return candidate ?? null;
	});
}
