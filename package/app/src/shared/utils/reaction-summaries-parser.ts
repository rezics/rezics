export type ReactionSummaryDTO = {
  likes?: number;
  dislikes?: number;
};

export function parseReactionSummaries(
  reactionSummariesArray: any[],
): ReactionSummaryDTO {
  if (!reactionSummariesArray) return { likes: 0, dislikes: 0 };
  const likes =
    reactionSummariesArray.find((reaction) => reaction.reaction === "like")
      ?.count ?? 0;
  const dislikes =
    reactionSummariesArray.find((reaction) => reaction.reaction === "dislike")
      ?.count ?? 0;

  return { likes, dislikes };
}
