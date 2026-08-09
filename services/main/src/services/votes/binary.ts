import { toSafeInteger } from "../database/integer";

export type BinaryVoteValue = -1 | 1;
export type OptionalBinaryVote = BinaryVoteValue | null;

export interface BinaryVoteSummary {
	readonly positiveCount: number;
	readonly negativeCount: number;
	readonly score: number;
	readonly voteCount: number;
	readonly viewerVote: OptionalBinaryVote;
	readonly asOf: Date | null;
}

function presentBinaryVote(value: unknown, name: string): OptionalBinaryVote {
	if (value === null || value === -1 || value === 1) return value;
	throw new TypeError(`${name} is not a binary vote`);
}

/**
 * Presents one aggregate only after proving it can be produced by -1/+1 votes.
 *
 * @internal Database checks preserve these invariants; this boundary also
 * protects API consumers from legacy or corrupted aggregate rows.
 */
export function presentBinaryVoteSummary(input: {
	readonly score: unknown;
	readonly voteCount: unknown;
	readonly viewerVote: unknown;
	readonly updatedAt: Date | null | undefined;
	readonly name: string;
}): BinaryVoteSummary {
	const score = toSafeInteger(input.score, `${input.name} score`);
	const voteCount = toSafeInteger(input.voteCount, `${input.name} vote count`);
	if (voteCount < 0 || Math.abs(score) > voteCount || (voteCount + score) % 2 !== 0)
		throw new RangeError(`${input.name} aggregate is not representable by binary votes`);

	return {
		positiveCount: (voteCount + score) / 2,
		negativeCount: (voteCount - score) / 2,
		score,
		voteCount,
		viewerVote: presentBinaryVote(input.viewerVote, `${input.name} viewer vote`),
		asOf: input.updatedAt ?? null,
	};
}
