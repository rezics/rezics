import { isDeepStrictEqual } from "node:util";
import type { z } from "zod";
import type { MusicBrainzRelationSchema } from "./musicbrainz";

type Relation = z.infer<typeof MusicBrainzRelationSchema>;
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
