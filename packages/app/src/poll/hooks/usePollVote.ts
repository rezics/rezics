import {
  useCastPollVoteMutation,
  useWithdrawPollVoteMutation,
} from "@rezics/contract/api/poll/poll.mutations";
import type { PollVoteMode } from "@rezics/contract";

export interface UsePollVoteArgs {
  pollUnitId: string;
  voteMode: PollVoteMode;
  /**
   * The option ids the caller currently holds (`PollResultsDTO.myVote`).
   * 调用方当前持有的选项 id（`PollResultsDTO.myVote`）。
   */
  myVote: string[];
  realmUnitId?: string | null;
  canVote?: boolean;
}

export interface UsePollVoteReturn {
  /**
   * Act on an option. SINGLE: casts/changes the caller's single vote. MULTI:
   * toggles — casts when the option is not already held, withdraws (with its
   * `optionId`) when it is. The underlying mutations write the refreshed
   * `PollResultsDTO` into the detail cache and invalidate it, so the display
   * picks up new tallies without local state.
   * 对某个选项执行操作。SINGLE：投出/改变调用方的单一投票。MULTI：切换——
   * 当选项尚未持有时投票，已持有时撤回（携带其 `optionId`）。底层 mutation
   * 会把刷新后的 `PollResultsDTO` 写入详情缓存并使其失效，因此显示无需本地
   * 状态即可获取新的计票结果。
   */
  select: (optionId: string) => void;
  isPending: boolean;
  error: Error | null;
}

/**
 * Voting semantics over the existing poll mutations. Mirrors how the tag and
 * engagement features defer all tally state to the mutation cache write +
 * invalidate rather than tracking it locally.
 * 基于现有 poll mutation 的投票语义。与 tag 和 engagement 功能一致：将所有
 * 计票状态交给 mutation 的缓存写入 + 失效处理，而非在本地追踪。
 */
export function usePollVote({
  pollUnitId,
  voteMode,
  myVote,
  realmUnitId,
  canVote = true,
}: UsePollVoteArgs): UsePollVoteReturn {
  const castVote = useCastPollVoteMutation(pollUnitId);
  const withdrawVote = useWithdrawPollVoteMutation(pollUnitId);

  const select = (optionId: string) => {
    if (!canVote) return;
    if (voteMode === "MULTI" && myVote.includes(optionId)) {
      withdrawVote.mutate({ optionId, realmUnitId: realmUnitId ?? undefined });
      return;
    }
    castVote.mutate({ optionId, realmUnitId: realmUnitId ?? undefined });
  };

  return {
    select,
    isPending: castVote.isPending || withdrawVote.isPending,
    error: castVote.error ?? withdrawVote.error,
  };
}
