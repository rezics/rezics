export type FeedReaction = "upvote" | "downvote" | null;

export function parseFeedReaction(value: string | null | undefined): FeedReaction {
	return value === "upvote" || value === "downvote" ? value : null;
}

function reactionContribution(reaction: FeedReaction): number {
	return reaction === "upvote" ? 1 : reaction === "downvote" ? -1 : 0;
}

export function getFeedReactionScore({
	current,
	initial,
	score,
}: {
	current: FeedReaction;
	initial: FeedReaction;
	score: number;
}): number {
	return score - reactionContribution(initial) + reactionContribution(current);
}
