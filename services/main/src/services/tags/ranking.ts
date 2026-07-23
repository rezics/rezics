export interface GlobalTagRankInput {
	readonly tagId: string;
	readonly pinned: boolean;
	readonly position: string | null;
	readonly score: number;
	readonly voteCount: number;
}

/**
 * Lower bound of the Wilson score interval for Bernoulli votes.
 *
 * Unit Tag votes are stored as -1 or +1, so the positive count can be derived
 * from the aggregate score and count without reading individual votes.
 */
export function wilsonLowerBound(score: number, voteCount: number): number {
	if (voteCount <= 0) return 0;
	const positiveCount = Math.max(0, Math.min(voteCount, (voteCount + score) / 2));
	const proportion = positiveCount / voteCount;
	const z = 1.96;
	const zSquared = z * z;
	const denominator = 1 + zSquared / voteCount;
	const center = proportion + zSquared / (2 * voteCount);
	const margin =
		z * Math.sqrt((proportion * (1 - proportion) + zSquared / (4 * voteCount)) / voteCount);
	return (center - margin) / denominator;
}

export function compareGlobalTagRank(left: GlobalTagRankInput, right: GlobalTagRankInput): number {
	if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
	if (left.pinned && left.position !== right.position)
		return left.position === null
			? 1
			: right.position === null
				? -1
				: left.position.localeCompare(right.position);
	const confidence =
		wilsonLowerBound(right.score, right.voteCount) -
		wilsonLowerBound(left.score, left.voteCount);
	if (confidence !== 0) return confidence;
	if (left.score !== right.score) return right.score - left.score;
	if (left.voteCount !== right.voteCount) return right.voteCount - left.voteCount;
	if (left.position !== right.position)
		return left.position === null
			? 1
			: right.position === null
				? -1
				: left.position.localeCompare(right.position);
	return left.tagId.localeCompare(right.tagId);
}
