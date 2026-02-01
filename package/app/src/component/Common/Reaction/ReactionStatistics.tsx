import {type ReactionSummaryDTO} from '@/shared/util/reactionSummariesParser';

export function ReactionStatistics({
  reactionSummaries,
  hideDislike = true,
}: {
  reactionSummaries: ReactionSummaryDTO;
  hideDislike?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-sm items-center flex-shrink-0">
      <div>{reactionSummaries?.likes ?? 0} 认同</div>
      {!hideDislike && <div>{reactionSummaries?.dislikes ?? 0} 不认同</div>}
      <div>{reactionSummaries?.bookmark ?? 0} 收藏</div>
      <div>{reactionSummaries?.comment ?? 0} 评论</div>
    </div>
  );
}
