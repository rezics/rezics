interface SearchGroupHit {
	readonly id: string;
}

interface SearchGroup<Hit extends SearchGroupHit> {
	readonly hits: readonly Hit[];
}

/**
 * Interleave category-ranked hits into one stable Feed order.
 *
 * Each category keeps its internal Search rank while one result from every
 * category is offered before a category can contribute its next result.
 */
export function mixSearchGroupHits<Hit extends SearchGroupHit>(
	groups: readonly SearchGroup<Hit>[],
): Hit[] {
	const seen = new Set<string>();
	const hits: Hit[] = [];
	const maximumGroupLength = groups.reduce(
		(maximum, group) => Math.max(maximum, group.hits.length),
		0,
	);
	for (let rank = 0; rank < maximumGroupLength; rank += 1)
		for (const group of groups) {
			const hit = group.hits[rank];
			if (!hit || seen.has(hit.id)) continue;
			seen.add(hit.id);
			hits.push(hit);
		}
	return hits;
}
