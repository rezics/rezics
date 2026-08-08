import type { RecommendationSort } from "./policy";

export interface RecommendationCandidate {
	readonly id: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
	readonly bestScore: number;
}

export type RankedRecommendation<T extends RecommendationCandidate> = T & {
	readonly rankScore: number;
};

function safeBestScore(value: number): number {
	return Number.isFinite(value) && value > 0 ? value : 0;
}

function compareDateThenId(
	leftDate: Date,
	leftId: string,
	rightDate: Date,
	rightId: string,
): number {
	return rightDate.getTime() - leftDate.getTime() || rightId.localeCompare(leftId);
}

/**
 * Applies the same deterministic tuples as the database indexes.
 *
 * `best`: (best_score DESC, updated_at DESC, id DESC)
 * `new`:  (created_at DESC, id DESC)
 */
export function rankRecommendations<T extends RecommendationCandidate>(
	candidates: readonly T[],
	options: { readonly sort: RecommendationSort },
): RankedRecommendation<T>[] {
	return candidates
		.map((candidate) => ({
			...candidate,
			rankScore:
				options.sort === "best"
					? safeBestScore(candidate.bestScore)
					: candidate.createdAt.getTime(),
		}))
		.sort((left, right) => {
			if (options.sort === "new")
				return compareDateThenId(left.createdAt, left.id, right.createdAt, right.id);
			return (
				safeBestScore(right.bestScore) - safeBestScore(left.bestScore) ||
				compareDateThenId(left.updatedAt, left.id, right.updatedAt, right.id)
			);
		});
}
