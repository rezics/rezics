export interface FeedRatingAggregate {
	readonly contextUnitId: string;
	readonly contextTitle?: string | null;
	readonly totalScore: string | number;
	readonly totalCount: string | number;
}

export interface FeedScoreCandidates {
	readonly preferred?: FeedRatingAggregate | null;
	readonly global?: FeedRatingAggregate | null;
}

/**
 * Feed ratings prefer the viewer's configured context only when that work has
 * an aggregate there. The official global aggregate is the per-work fallback.
 */
export function selectFeedRating(candidates: FeedScoreCandidates): FeedRatingAggregate | null {
	return candidates.preferred ?? candidates.global ?? null;
}
