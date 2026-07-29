export interface FeedRatingAggregate {
	readonly realmId: string;
	readonly realmTitle?: string | null;
	readonly totalScore: string | number;
	readonly totalCount: string | number;
}

export interface FeedScoreCandidates {
	readonly preferred?: FeedRatingAggregate | null;
	readonly global?: FeedRatingAggregate | null;
}

/**
 * Feed ratings prefer the viewer's configured Realm only when that work has
 * an aggregate there. The official global aggregate is the per-work fallback.
 */
export function selectFeedRating(candidates: FeedScoreCandidates): FeedRatingAggregate | null {
	return candidates.preferred ?? candidates.global ?? null;
}
