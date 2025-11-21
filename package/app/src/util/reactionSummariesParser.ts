export type ReactionSummaryDTO = {
  likes?: number;
  dislikes?: number;
  bookmark?: number;
  comment?: number;
};

export function parseReactionSummaries(
  reactionSummariesArray: any[],
): ReactionSummaryDTO {
  const likes =
    reactionSummariesArray.find(reaction => reaction.reaction === 'like')
      ?.count ?? 0;
  const dislikes =
    reactionSummariesArray.find(reaction => reaction.reaction === 'dislike')
      ?.count ?? 0;
  const bookmark =
    reactionSummariesArray.find(reaction => reaction.reaction === 'bookmark')
      ?.count ?? 0;
  const comment =
    reactionSummariesArray.find(reaction => reaction.reaction === 'comment')
      ?.count ?? 0;

  return {likes, dislikes, bookmark, comment};
}
